import React, { useState, useEffect, useRef } from 'react';
import ProfileTab from './client-hub/ProfileTab';
import AddClientModal from './AddClientModal';
import RemoveClientModal from './RemoveClientModal';
import { getLeads, getTasks, getTemplates, seedMockData, saveUserProfile, getUserProfile, updateLead, getReminderRules, updateReminderRule, deleteAllMockData, getRealtorClients, deleteLead, deleteUserAccount, auth } from '../services/firebaseService';
import { getInitialMockLeads, getInitialMockTasks, getInitialMockTemplates, getInitialMockTransactions } from '../services/mockDataService';
import { getDefaultReminderRules } from '../services/reminderRulesService';
import { UserProfile, Lead, CRMTask, CommTemplate, FunnelStage, ReminderRule, LeadNote, RealtorNode } from '../types';
import { DropResult } from '@hello-pangea/dnd';
import Logo from './Logo';
import LeadsList from './LeadsList';

// Sub-components
import ClientDetailsView from './client-hub/ClientDetailsView';
import TaskBoard from './client-hub/TaskBoard';
import StatusSettings from './client-hub/StatusSettings';
import { StatusOption } from '../types';
import { isTerminalStatus, getFunnelStageForStatus, getStatusOptions } from '../services/statusService';
import { getDeviceType } from '../utils/deviceDetection';
import WhiteboardTab from './client-hub/WhiteboardTab';
import ClosingDashboard from './client-hub/ClosingDashboard';
import BestPracticesTab from './client-hub/BestPracticesTab';
import GuidesTab from './client-hub/GuidesTab';
import ReactivateTab from './client-hub/ReactivateTab';
import CreativeStudioWidget from './client-hub/reactivate/components/CreativeStudioWidget';
import BulkPrefetchTab from './client-hub/BulkPrefetchTab';
import CityDataTab from './client-hub/CityDataTab';
import StorageScannerTab from './client-hub/StorageScannerTab';
import Footer from './Footer';

interface Props {
    realtorId: string;
    realtorName: string;
    onSignOut: () => void;
    onBack: () => void;
    exploreContent?: React.ReactNode;
    initialTab?: HubTab;
    onNavigate?: (view: any, path: string) => void;
    onUpdateProfile?: (updates: Partial<UserProfile>) => void;
}

const generateClientID = () => {
    return 'C-' + Math.random().toString(36).substring(2, 7).toUpperCase();
};

type HubTab = 'explore' | 'leads' | 'tasks' | 'settings' | 'whiteboard' | 'closing' | 'reactivate' | 'best_practices' | 'clients' | 'creative_studio' | 'guides' | 'profile' | 'bulk_prefetch' | 'city_data' | 'storage_registry';

const ClientHub: React.FC<Props> = ({ realtorId, realtorName, onSignOut, onBack, exploreContent, initialTab, onNavigate, onUpdateProfile }) => {
    // Default to 'explore' if content is provided, otherwise 'leads'
    const [activeTab, setActiveTab] = useState<HubTab>(initialTab || (exploreContent ? 'explore' : 'leads'));

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const [isMobile, setIsMobile] = useState(false);
    const [isNarrow, setIsNarrow] = useState(false);

    useEffect(() => {
        setIsMobile(getDeviceType() === 'mobile');

        const handleResize = () => {
            setIsNarrow(window.innerWidth < 1200);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const showHamburger = isMobile || isNarrow;

    const [realtorProfile, setRealtorProfile] = useState<UserProfile | null>(null);
    const [isToolsOpen, setIsToolsOpen] = useState(false);
    const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobileToolsExpanded, setIsMobileToolsExpanded] = useState(false);
    const [isMobileSettingsExpanded, setIsMobileSettingsExpanded] = useState(false);
    const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
    const [isRemoveClientModalOpen, setIsRemoveClientModalOpen] = useState(false);
    const toolsRef = useRef<HTMLDivElement>(null);

    const [clients, setClients] = useState<UserProfile[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);
    const [explicitlySelectedClientId, setExplicitlySelectedClientId] = useState<string | undefined>(undefined);



    const [leads, setLeads] = useState<Lead[]>([]);
    const [tasks, setTasks] = useState<CRMTask[]>([]);
    const [templates, setTemplates] = useState<CommTemplate[]>([]);
    const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
    const [loadingData, setLoadingData] = useState(true);


    const [pendingNote, setPendingNote] = useState<{ leadId: string, color: string } | null>(null);



    useEffect(() => {
        const initializeHubData = async () => {
            setLoadingData(true);

            // 1. Fetch Existing Data
            let _leads = await getLeads(realtorId, ['leads']);
            let _tasks = await getTasks(realtorId);
            let _templates = await getTemplates(realtorId);

            // 2. Load reminder rules from APP (not database)
            const appRules = getDefaultReminderRules().map(rule => ({
                ...rule,
                realtorId
            }));

            // 3. Try to fetch any customized rules from database
            let dbRules = await getReminderRules(realtorId);

            const mergedRules = appRules.map(appRule => {
                const dbRule = dbRules.find(r => r.id === appRule.id);
                // Merge to ensure new system flags (like isExecutable) are picked up
                // even if the rule already exists in the database.
                return dbRule ? { ...appRule, ...dbRule } : appRule;
            });

            setReminderRules(mergedRules);
            console.log(`[ClientHub] Loaded ${mergedRules.length} rules (${dbRules.length} from DB, ${mergedRules.length - dbRules.length} from app defaults)`);

            // 2. Define Mock Data (Always available for potential seeding)
            console.log("[ClientHub] Seeding initial mock data...");
            const initialLeads: Lead[] = getInitialMockLeads(realtorId);
            const initialTasks: CRMTask[] = getInitialMockTasks(realtorId);
            const initialTemplates: CommTemplate[] = getInitialMockTemplates(realtorId);

            // Check if we need to seed (if any mock leads are missing, in wrong collection, or missing KYC data)
            const shouldSeed = initialLeads.some(l => {
                const existing = _leads.find(ex => ex.id === l.id);
                if (!existing) return true;
                if (l.collectionName && existing.collectionName !== l.collectionName) return true;
                return false;
            });

            if (shouldSeed) {
                console.log("[ClientHub] Missing mock data detected. Seeding...");
                const initialTransactions = getInitialMockTransactions(realtorId);
                const seedResult = await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates, initialTransactions);
                console.log("[ClientHub] Seed result:", seedResult);

                // Re-fetch after seeding
                _leads = await getLeads(realtorId, ['leads']);
                console.log(`[ClientHub] Re-fetched leads count: ${_leads.length}`);
                _tasks = await getTasks(realtorId);
                _templates = await getTemplates(realtorId);
            }

            // Forced Merge: Ensure local state has mock data even if Firestore is slightly behind 
            // This is safer for development UX
            const finalLeads = _leads.map(lead => {
                if (lead.isMock) {
                    const mockTemplate = initialLeads.find(l => l.id === lead.id);
                    if (mockTemplate) {
                        // MERGE: Firestore data (lead) should OVERWRITE template data (mockTemplate)
                        return { ...mockTemplate, ...lead };
                    }
                }
                return lead;
            });
            console.log(`[ClientHub] Final leads set to state: ${finalLeads.length} for RealtorID: ${realtorId}`);

            setLeads(finalLeads);
            setTasks(_tasks);
            setTemplates(_templates);
            setLoadingData(false);


        };
        initializeHubData();
    }, [realtorId]);


    useEffect(() => {
        const fetchRealtorProfile = async () => {
            let profile = await getUserProfile(realtorId);

            // If no profile exists in Firestore, use a skeleton based on props
            if (!profile) {
                profile = {
                    uid: realtorId,
                    displayName: realtorName,
                    role: 'realtor',
                    email: auth?.currentUser?.email || '', // Get email from current auth session
                    createdAt: new Date()
                } as UserProfile;
            }

            if (profile && !profile.realtor && profile.role === 'realtor') {
                // Migration: Populate dynamic realtor node if missing
                const defaultRealtor: RealtorNode = {
                    bio: "Real estate professional dedicated to providing exceptional service and market expertise. Helping clients find their dream homes with data-driven insights.",
                    brokerage: "Zyphe Real Estate",
                    yearsExperience: 10,
                    specialties: ["Residential", "Luxury Properties", "Strategic Negotiation"],
                    languages: ["English"],
                    serviceAreas: ["Major Metropolitan Area"],
                    socialLinks: {
                        linkedin: "",
                        facebook: "",
                        instagram: "",
                        twitter: ""
                    },
                    totalSales: "142",
                    avgPrice: "$1.2M",
                    totalClients: "350+"
                };
                profile.realtor = defaultRealtor;
                // Optional: Save this default state back to DB
                await saveUserProfile(realtorId, { realtor: defaultRealtor });
            }
            setRealtorProfile(profile);
        };
        fetchRealtorProfile();
    }, [realtorId, realtorName]);


    const handleRefreshTasks = async () => {
        const _tasks = await getTasks(realtorId);
        setTasks(_tasks);
    };

    useEffect(() => {
        const fetchClients = async () => {
            setLoadingClients(true);
            const data = await getRealtorClients(realtorId);
            setClients(data);
            setLoadingClients(false);
        };
        fetchClients();
    }, [realtorId]);





    const handleUpdateLead = async (leadId: string, updates: Partial<Lead>, collectionName: string = 'leads') => {
        const currentLead = leads.find(l => l.id === leadId);
        const currentClient = clients.find(c => c.uid === leadId);
        const isUserCollection = collectionName === 'users' || (!currentLead && currentClient);

        if (currentLead && !isUserCollection) {
            const now = new Date();

            // Automatically sync funnelStage if status is changing
            if (updates.status && updates.status !== currentLead.status) {
                const newStage = getFunnelStageForStatus(updates.status, currentLead.leadType) as any;
                if (newStage !== currentLead.funnelStage) {
                    updates.funnelStage = newStage;
                }
            }

            // Stage History Logic
            if (updates.funnelStage && updates.funnelStage !== currentLead.funnelStage) {
                updates.stageLastChangedAt = now;
                const history = [...(currentLead.stageHistory || [])];
                const lastHistoryIndex = history.findIndex(h => !h.exitedAt);
                if (lastHistoryIndex !== -1) {
                    history[lastHistoryIndex] = { ...history[lastHistoryIndex], exitedAt: now };
                }
                history.push({
                    fromStage: currentLead.funnelStage,
                    toStage: updates.funnelStage,
                    enteredAt: now
                });
                updates.stageHistory = history as any;
            }

            // Archiving
            if (updates.status === 'Archived' && currentLead.status !== 'Archived') {
                updates.archivedAt = now;
            } else if (currentLead.status === 'Archived' && updates.status && updates.status !== 'Archived') {
                updates.activatedAt = now;
            }

            if (isTerminalStatus(updates.status || '', currentLead.leadType) && !isTerminalStatus(currentLead.status, currentLead.leadType)) {
                updates.closedAt = now;
            }

            if (!updates.subjectProperty && currentLead.propertyAddress && !currentLead.subjectProperty) {
                updates.subjectProperty = currentLead.propertyAddress;
            }

            if (!currentLead.clientId && !updates.clientId) {
                updates.clientId = generateClientID();
            }
        }

        // 1. Optimistically update local state
        if (isUserCollection) {
            setClients(prev => prev.map(c => c.uid === leadId ? { ...c, ...updates } : c));
        } else {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));
        }

        // 2. Persist to Firestore
        const success = await updateLead(leadId, updates, collectionName);

        if (!success) {
            // Revert on failure (simple version: just log for now as state might have changed significantly)
            console.error('Failed to save changes to Firestore');
        }
        return success;
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
                setIsToolsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        // Custom Note Handling (Palette Drop onto Lead)
        if (draggableId.startsWith('note-') && destination && destination.droppableId.startsWith('note-drop-')) {
            const leadId = destination.droppableId.replace('note-drop-', '');
            // Extract base ID (e.g., 'note-yellow' from 'note-yellow-buyer')
            const baseNoteId = draggableId.split('-').slice(0, 2).join('-');

            const colorMap: any = {
                'note-yellow': 'bg-[#ffff88] text-slate-800 border-[#eeee77] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
                'note-blue': 'bg-[#7afaff] text-slate-800 border-[#69e9ee] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
                'note-red': 'bg-[#ff7e7e] text-white border-[#ee6d6d] shadow-[5px_5px_7px_rgba(33,33,33,.1)]',
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

        // Warn if subjectProperty is not set for Offer and Contract stages (but don't block drag)
        if (['Offer', 'Contract'].includes(newStage)) {
            const subjectProperty = lead.subjectProperty || lead.propertyAddress;
            if (!subjectProperty || !subjectProperty.trim()) {
                console.warn('[ClientHub] Moving to Offer/Contract stage without Subject Property. Consider adding one.');
            }
        }

        // Auto-populate subjectProperty if moving to Offer/Contract and it's empty but propertyAddress exists
        const additionalUpdates: any = {};
        if (['Offer', 'Contract'].includes(newStage) && !lead.subjectProperty && lead.propertyAddress) {
            additionalUpdates.subjectProperty = lead.propertyAddress;
        }

        // Delegate to handleUpdateLead which handles history, persistence and state syncing
        const updates: any = { funnelStage: newStage, ...additionalUpdates };
        await handleUpdateLead(leadId, updates);
    };


    const handleAddNote = async (leadId: string, content: string, color: string) => {
        if (!content.trim()) return;

        const lead = leads.find(l => l.id === leadId);
        if (!lead) return;

        const newNote: LeadNote = {
            id: 'note-' + Date.now(),
            content: content,
            timestamp: new Date(),
            color: color,
            type: 'general'
        };

        const updatedLeadNotes = [newNote, ...(lead.leadNotes || [])];
        const updatedNotesLog = [newNote, ...(lead.notesLog || [])];

        await handleUpdateLead(lead.id, {
            leadNotes: updatedLeadNotes,
            notesLog: updatedNotesLog,
            notes: content
        });

        return newNote.id;
    };

    const handleSaveLeadNote = async (content: string) => {
        if (!pendingNote || !content.trim()) return;
        await handleAddNote(pendingNote.leadId, content, pendingNote.color);
        setPendingNote(null);
    };

    const handleResetAllData = async () => {
        try {
            await deleteAllMockData(realtorId);
            // Refresh leads and tasks
            const _leads = await getLeads(realtorId, ['leads']);
            const _tasks = await getTasks(realtorId);
            setLeads(_leads);
            setTasks(_tasks);
        } catch (err) {
            console.error("Failed to reset data:", err);
            throw err;
        }
    };

    const handleSeedManualMockData = async () => {
        try {
            const initialLeads = getInitialMockLeads(realtorId);
            const initialTasks = getInitialMockTasks(realtorId);
            const initialTemplates = getInitialMockTemplates(realtorId);
            const initialTransactions = getInitialMockTransactions(realtorId);
            await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates, initialTransactions);

            // Refresh
            const _leads = await getLeads(realtorId, ['leads']);
            const _tasks = await getTasks(realtorId);
            setLeads(_leads);
            setTasks(_tasks);
        } catch (err) {
            console.error("Failed to seed data:", err);
            throw err;
        }
    };

    const handleUpdateLeadNote = async (noteId: string, updates: Partial<LeadNote>) => {
        const lead = leads.find(l => (l.leadNotes || []).some(n => n.id === noteId) || (l.notesLog || []).some(n => n.id === noteId));
        if (!lead) return;

        const updatedLeadNotes = (lead.leadNotes || []).map(n => n.id === noteId ? { ...n, ...updates } : n);
        const updatedNotesLog = (lead.notesLog || []).map(n => n.id === noteId ? { ...n, ...updates } : n);

        await handleUpdateLead(lead.id, {
            leadNotes: updatedLeadNotes,
            notesLog: updatedNotesLog
        });
    };

    const handleDeleteLeadNote = async (noteId: string) => {
        const lead = leads.find(l => (l.leadNotes || []).some(n => n.id === noteId) || (l.notesLog || []).some(n => n.id === noteId));
        if (!lead) return;

        const updatedLeadNotes = (lead.leadNotes || []).filter(n => n.id !== noteId);
        const updatedNotesLog = (lead.notesLog || []).filter(n => n.id !== noteId);

        await handleUpdateLead(lead.id, {
            leadNotes: updatedLeadNotes,
            notesLog: updatedNotesLog
        });
    };

    const handleCreateLead = (initialUpdates?: Partial<Lead>) => {
        const newLead: Lead = {
            id: `lead_${Date.now()}`,
            clientId: generateClientID(),
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            status: 'New',
            receivedAt: new Date(),
            source: 'Manual',
            leadType: 'Buyer',
            slaUrgency: 'medium',
            funnelStage: 'Leads',
            health: 'Active',
            ...initialUpdates
        };
        console.log("Skipping modal open for new lead");
    };

    const mainTabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'explore', label: 'Explore', icon: 'fa-globe' },
        { id: 'leads', label: 'Funnel', icon: 'fa-bullseye' },
        { id: 'closing', label: 'Closing', icon: 'fa-file-invoice-dollar' },
        { id: 'reactivate', label: 'Reactivate', icon: 'fa-bolt' },
        { id: 'clients', label: 'Clients', icon: 'fa-user-group' },
    ];

    const toolTabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'tasks', label: 'Tasks', icon: 'fa-check-double' },
        { id: 'whiteboard', label: 'Whiteboard', icon: 'fa-pen-to-square' },
        { id: 'creative_studio', label: 'Creative Studio', icon: 'fa-paintbrush' },
        { id: 'settings', label: 'Data Fields', icon: 'fa-sliders' },
        { id: 'best_practices', label: 'Best Practices', icon: 'fa-book-open' },
    ];

    const adminTabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'city_data', label: 'City Data', icon: 'fa-city' },
        { id: 'bulk_prefetch', label: 'Bulk Ingestion', icon: 'fa-layer-group' },
        { id: 'storage_registry', label: 'Storage Registry', icon: 'fa-server' },
    ];






    return (
        <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col animate-in fade-in duration-500 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Top Header / Tab Bar */}
            <header className="bg-slate-900 px-4 sm:px-8 py-0 grid grid-cols-3 items-center border-b border-white/5 shadow-2xl relative z-[110]">
                {/* Left Section: Navigation / Hamburger */}
                <div className="flex items-center justify-start h-full">
                    {/* Hamburger Menu (Mobile Only) */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className={`${showHamburger ? 'flex' : 'hidden'} w-10 h-10 items-center justify-center text-white text-xl`}
                    >
                        <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
                    </button>

                    <nav className={`${showHamburger ? 'hidden' : 'flex'} items-center h-[72px]`}>
                        {mainTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    if (onNavigate) onNavigate(tab.id as any, '');
                                }}
                                className={`relative h-full flex items-center gap-3 px-4 text-[10px] font-bold uppercase tracking-widest transition-all group overflow-hidden ${activeTab === tab.id ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                <i className={`fa-solid ${tab.icon} transition-transform group-hover:scale-110 ${activeTab === tab.id ? 'text-indigo-500' : 'text-slate-500'}`}></i>
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in slide-in-from-bottom border-t border-indigo-400/50"></div>
                                )}
                            </button>
                        ))}

                        {/* Realtor Tools Dropdown */}
                        <div className="relative h-full" ref={toolsRef}>
                            <button
                                onClick={() => setIsToolsOpen(!isToolsOpen)}
                                className={`relative h-full flex items-center gap-3 px-4 text-[10px] font-bold uppercase tracking-widest transition-all group overflow-hidden ${(toolTabs.some(t => t.id === activeTab) || adminTabs.some(t => t.id === activeTab)) ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                <i className={`fa-solid fa-toolbox transition-transform group-hover:scale-110 ${(toolTabs.some(t => t.id === activeTab) || adminTabs.some(t => t.id === activeTab)) ? 'text-indigo-500' : 'text-slate-500'}`}></i>
                                Tools
                                <i className={`fa-solid fa-chevron-down text-[8px] transition-transform duration-300 ${isToolsOpen ? 'rotate-180' : ''}`}></i>
                                {(toolTabs.some(t => t.id === activeTab) || adminTabs.some(t => t.id === activeTab)) && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in slide-in-from-bottom border-t border-indigo-400/50"></div>
                                )}
                            </button>

                            {isToolsOpen && (
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                    {toolTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                setActiveTab(tab.id);
                                                setIsToolsOpen(false);
                                                if (onNavigate) onNavigate(tab.id as any, '');
                                            }}
                                            className={`w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500'}`}
                                        >
                                            <i className={`fa-solid ${tab.icon} w-4 text-center ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}></i>
                                            {tab.label}
                                        </button>
                                    ))}

                                    <div className="h-px bg-slate-100 my-1.5 mx-3"></div>

                                    <div className="relative group/admin">
                                        <button
                                            className="w-full flex items-center justify-between gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 text-slate-500 hover:text-indigo-600"
                                        >
                                            <div className="flex items-center gap-4">
                                                <i className="fa-solid fa-lock w-4 text-center text-slate-400 group-hover/admin:text-indigo-600"></i>
                                                Admin
                                            </div>
                                            <i className="fa-solid fa-chevron-right text-[8px] text-slate-300 group-hover/admin:text-indigo-400"></i>
                                        </button>

                                        {/* Horizontal Flyout Sub-menu */}
                                        <div className="absolute left-full top-[-12px] ml-1 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl py-3 z-[110] hidden group-hover/admin:block animate-in fade-in slide-in-from-left-2 duration-200">
                                            {adminTabs.map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => {
                                                        setActiveTab(tab.id);
                                                        setIsToolsOpen(false);
                                                        if (onNavigate) onNavigate(tab.id as any, '');
                                                    }}
                                                    className={`w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-50 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-500'}`}
                                                >
                                                    <i className={`fa-solid ${tab.icon} w-4 text-center ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}></i>
                                                    {tab.label}
                                                </button>
                                            ))}

                                            <div className="h-px bg-slate-100 my-1.5 mx-3"></div>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm("Are you sure you want to RESET all data? This will delete all mock leads, tasks, and templates.")) {
                                                        await handleResetAllData();
                                                        setIsToolsOpen(false);
                                                        alert("Data reset successfully.");
                                                    }
                                                }}
                                                className="w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                                            >
                                                <i className="fa-solid fa-trash-can w-4 text-center text-rose-400"></i>
                                                Reset Data
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    await handleSeedManualMockData();
                                                    setIsToolsOpen(false);
                                                    alert("Mock data seeded successfully.");
                                                }}
                                                className="w-full flex items-center gap-4 px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-50 text-slate-500 hover:text-indigo-600"
                                            >
                                                <i className="fa-solid fa-database w-4 text-center text-indigo-400"></i>
                                                Seed Mock Data
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Guides Tab */}
                        <button
                            onClick={() => {
                                setActiveTab('guides');
                                if (onNavigate) onNavigate('guides', '');
                            }}
                            className={`relative h-full flex items-center gap-3 px-4 text-[10px] font-bold uppercase tracking-widest transition-all group overflow-hidden ${activeTab === 'guides' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <i className={`fa-solid fa-book transition-transform group-hover:scale-110 ${activeTab === 'guides' ? 'text-indigo-500' : 'text-slate-500'}`}></i>
                            Guides
                            {activeTab === 'guides' && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in slide-in-from-bottom border-t border-indigo-400/50"></div>
                            )}
                        </button>
                    </nav>
                </div>

                {/* Center Section: Logo */}
                <div className="flex items-center justify-center py-4">
                    <Logo size={showHamburger ? 45 : 60} onClick={() => {
                        setActiveTab('explore');
                        setIsMobileMenuOpen(false);
                    }} className="cursor-pointer transition-transform hover:scale-105" />
                </div>

                {/* Right Section: User Controls */}
                <div className="flex items-center justify-end gap-3 sm:gap-6 h-full">
                    <div className={`${showHamburger ? 'hidden' : 'flex'} flex-col items-end`}>
                        <span className="text-white font-black text-[11px] tracking-tight">{realtorName}</span>
                        <button
                            onClick={onSignOut}
                            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-400 transition-colors mt-0.5 group/signout cursor-pointer"
                        >
                            <i className="fa-solid fa-right-from-bracket text-[9px] group-hover/signout:-translate-x-0.5 transition-all"></i>
                            Sign Out
                        </button>
                    </div>

                    {realtorProfile?.realtor?.photoURL && (
                        <div>
                            <img
                                src={realtorProfile.realtor.photoURL}
                                alt="Profile"
                                onClick={() => {
                                    setActiveTab('profile');
                                    setIsMobileMenuOpen(false);
                                }}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full sm:rounded-xl object-cover cursor-pointer transition-transform hover:scale-105 border border-white/10 shadow-lg"
                            />
                        </div>
                    )}

                    <div className={`relative z-50 ${showHamburger ? 'hidden' : 'block'}`}>
                        <button
                            onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                            onBlur={() => setTimeout(() => setIsSettingsDropdownOpen(false), 200)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isSettingsDropdownOpen || activeTab === 'settings' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title="Settings"
                        >
                            <i className="fa-solid fa-gear text-sm"></i>
                        </button>

                        {/* Dropdown Menu */}
                        {isSettingsDropdownOpen && (
                            <div className="absolute right-0 top-full mt-3 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                <div className="p-1.5 space-y-0.5">
                                    <button
                                        onClick={() => {
                                            setActiveTab('profile');
                                            setIsSettingsDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 rounded-xl transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                            <i className="fa-solid fa-id-badge text-xs"></i>
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">My Profile</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsAddClientModalOpen(true);
                                            setIsSettingsDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 rounded-xl transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                            <i className="fa-solid fa-user-plus text-xs"></i>
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Add a client</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIsRemoveClientModalOpen(true);
                                            setIsSettingsDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 rounded-xl transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
                                            <i className="fa-solid fa-user-minus text-xs"></i>
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 group-hover:text-slate-900">Remove a client</span>
                                    </button>

                                    <div className="h-px bg-slate-100 my-1 mx-2"></div>

                                    <button
                                        onClick={async () => {
                                            if (window.confirm("CRITICAL: Are you sure you want to delete your account? This will permanently remove your profile and all associated data. This cannot be undone.")) {
                                                try {
                                                    const success = await deleteUserAccount(realtorId);
                                                    if (success) {
                                                        onSignOut();
                                                    }
                                                } catch (err: any) {
                                                    alert(err.message || "Failed to delete account");
                                                }
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-rose-50 rounded-xl transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                                            <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                                        </div>
                                        <span className="text-xs font-bold text-rose-600 group-hover:text-rose-700">Delete Account</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Mobile Dropdown Menu */}
            {showHamburger && isMobileMenuOpen && (
                <div className="fixed inset-0 z-[105] bg-slate-900 pt-[72px] animate-in slide-in-from-top duration-300">
                    <div className="flex flex-col p-4 space-y-1.5 max-h-screen overflow-y-auto pb-24">
                        {/* Main Navigation Sections */}
                        {[...mainTabs, { id: 'guides', label: 'Guides', icon: 'fa-book' }].map((tab: any) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id as HubTab);
                                    setIsMobileMenuOpen(false);
                                    if (onNavigate) onNavigate(tab.id as any, '');
                                }}
                                className={`flex items-center gap-4 w-full p-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-800/50 text-slate-400 hover:text-white border border-white/5'}`}
                            >
                                <i className={`fa-solid ${tab.icon} w-5 text-center ${activeTab === tab.id ? 'text-white' : 'text-slate-500'} text-xs`}></i>
                                {tab.label}
                            </button>
                        ))}

                        {/* Realtor Tools Group (Data Fields moved here) */}
                        <div className="space-y-1.5 pt-2">
                            <button
                                onClick={() => setIsMobileToolsExpanded(!isMobileToolsExpanded)}
                                className={`flex items-center justify-between w-full p-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${(toolTabs.some(t => t.id === activeTab) || adminTabs.some(t => t.id === activeTab) || isMobileToolsExpanded) ? 'text-indigo-400' : 'text-slate-400 hover:text-white bg-slate-800/50 border border-white/5'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <i className="fa-solid fa-toolbox w-5 text-center text-xs"></i>
                                    Realtor Tools
                                </div>
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${isMobileToolsExpanded ? 'rotate-180' : ''}`}></i>
                            </button>

                            {isMobileToolsExpanded && (
                                <div className="pl-4 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                                    {toolTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                setActiveTab(tab.id as HubTab);
                                                setIsMobileMenuOpen(false);
                                                if (onNavigate) onNavigate(tab.id as any, '');
                                            }}
                                            className={`flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            <i className={`fa-solid ${tab.icon} w-5 text-center text-[10px]`}></i>
                                            {tab.label === 'Data Fields' ? 'Data Fields' : tab.label}
                                        </button>
                                    ))}

                                    <div className="h-px bg-white/5 my-2 mx-4"></div>
                                    <div className="px-4 py-2 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Admin</div>

                                    {adminTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                setActiveTab(tab.id as HubTab);
                                                setIsMobileMenuOpen(false);
                                                if (onNavigate) onNavigate(tab.id as any, '');
                                            }}
                                            className={`flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === tab.id ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            <i className={`fa-solid ${tab.icon} w-5 text-center text-[10px]`}></i>
                                            {tab.label}
                                        </button>
                                    ))}

                                    <div className="h-px bg-white/5 my-2 mx-4"></div>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm("Are you sure you want to RESET all data? This will delete all mock leads, tasks, and templates.")) {
                                                await handleResetAllData();
                                                setIsMobileMenuOpen(false);
                                                alert("Data reset successfully.");
                                            }
                                        }}
                                        className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-rose-400 transition-all"
                                    >
                                        <i className="fa-solid fa-trash-can w-5 text-center text-[10px]"></i>
                                        Reset Data
                                    </button>
                                    <button
                                        onClick={async () => {
                                            await handleSeedManualMockData();
                                            setIsMobileMenuOpen(false);
                                            alert("Mock data seeded successfully.");
                                        }}
                                        className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-indigo-400 transition-all"
                                    >
                                        <i className="fa-solid fa-database w-5 text-center text-[10px]"></i>
                                        Seed Mock Data
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Settings Group (Account and Profile) */}
                        <div className="space-y-1.5 pt-2">
                            <button
                                onClick={() => setIsMobileSettingsExpanded(!isMobileSettingsExpanded)}
                                className={`flex items-center justify-between w-full p-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'profile' ? 'text-indigo-400' : 'text-slate-400 hover:text-white bg-slate-800/50 border border-white/5'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <i className="fa-solid fa-gear w-5 text-center text-xs"></i>
                                    Settings
                                </div>
                                <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-300 ${isMobileSettingsExpanded ? 'rotate-180' : ''}`}></i>
                            </button>

                            {isMobileSettingsExpanded && (
                                <div className="pl-4 space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                                    <button
                                        onClick={() => {
                                            setActiveTab('profile');
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={`flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all ${activeTab === 'profile' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        <i className="fa-solid fa-id-badge w-5 text-center text-[10px]"></i>
                                        My Profile
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsAddClientModalOpen(true);
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-slate-300 transition-all"
                                    >
                                        <i className="fa-solid fa-user-plus w-5 text-center text-[10px]"></i>
                                        Add a client
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsRemoveClientModalOpen(true);
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 hover:text-slate-300 transition-all"
                                    >
                                        <i className="fa-solid fa-user-minus w-5 text-center text-[10px]"></i>
                                        Remove a client
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (window.confirm("CRITICAL: Are you sure you want to delete your account? This will permanently remove your profile and all associated data. This cannot be undone.")) {
                                                try {
                                                    const success = await deleteUserAccount(realtorId);
                                                    if (success) {
                                                        onSignOut();
                                                    }
                                                } catch (err: any) {
                                                    alert(err.message || "Failed to delete account");
                                                }
                                            }
                                        }}
                                        className="flex items-center gap-4 w-full p-3 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] text-rose-500/80 hover:text-rose-400 transition-all"
                                    >
                                        <i className="fa-solid fa-triangle-exclamation w-5 text-center text-[10px]"></i>
                                        Delete Account
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 mt-4 border-t border-white/5">
                            <button
                                onClick={onSignOut}
                                className="flex items-center gap-4 w-full p-4 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] text-rose-400 bg-rose-500/5 border border-rose-500/10"
                            >
                                <i className="fa-solid fa-right-from-bracket w-5 text-center text-xs"></i>
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
                <div className="flex flex-col min-h-full">
                    <div className="flex-1 flex flex-col">
                        {activeTab === 'explore' && exploreContent && (
                            <div className="bg-slate-50">
                                {exploreContent}
                            </div>
                        )}

                        {activeTab === 'clients' && (
                            <ClientDetailsView
                                realtorId={realtorId}
                                clients={clients}
                                leads={leads}
                                loading={loadingClients}
                                onUpdateClient={handleUpdateLead}
                                initialSelectedId={explicitlySelectedClientId}
                            />
                        )}

                        {activeTab === 'leads' && (
                            <LeadsList
                                realtorId={realtorId}
                                leads={leads}
                                isMobile={isMobile}
                                onUpdateLead={(id, updates) => handleUpdateLead(id, updates)}
                                onCreateLead={handleCreateLead}
                                pendingNote={pendingNote}
                                setPendingNote={setPendingNote}
                                handleSaveNote={handleSaveLeadNote}
                                handleUpdateNote={handleUpdateLeadNote}
                                handleDeleteNote={handleDeleteLeadNote}
                                handleDragEnd={handleDragEnd}
                                onUpdateAvatar={async (leadId, file) => {
                                    // Mock upload simulation as requested
                                    console.log('Simulating upload for file:', file.name);
                                    // Generate a new random avatar URL to simulate the "downloaded" photo
                                    const randomId = Math.floor(Math.random() * 1000);
                                    const newAvatarUrl = `https://i.pravatar.cc/150?img=${randomId}&u=${Date.now()}`; // Add timestamp to force refresh if same ID

                                    // Update the lead
                                    const lead = leads.find(l => l.id === leadId);
                                    if (lead) {
                                        await handleUpdateLead(leadId, { avatarUrl: newAvatarUrl });
                                    }
                                }}
                                onTabChange={(tab: any) => {
                                    if (tab === 'settings:properties') {
                                        setActiveTab('settings');
                                    } else if (tab !== 'Buyer' && tab !== 'Buyer2' && tab !== 'Seller') {
                                        setActiveTab(tab);
                                    }
                                }}
                                onActivateLead={(leadOrId: any) => {
                                    const id = typeof leadOrId === 'string' ? leadOrId : leadOrId.id;
                                    setExplicitlySelectedClientId(id);
                                    setActiveTab('clients');
                                }}
                            />
                        )}


                        {activeTab === 'closing' && (
                            <ClosingDashboard
                                leads={leads}
                                onUpdateLead={handleUpdateLead}
                                realtorId={realtorId}
                                onNavigateToClient={(clientId) => {
                                    // Find the client to ensure we have valid ID
                                    const client = clients.find(c => c.uid === clientId) || leads.find(l => l.id === clientId);
                                    if (client) {
                                        // Add a slightly delayed state update to ensure the tab switch happens cleanly
                                        // We use a specific state in ClientDetailsView to handle selection, but here we can just rely on props if we pass selectedId
                                        // However, ClientDetailsView uses internal state for selection. 
                                        // We'll pass a prop "initialSelectedId" which we are already doing via a new state variable we need to add.
                                        setExplicitlySelectedClientId(clientId);
                                        setActiveTab('clients');
                                    }
                                }}
                            />
                        )}

                        {activeTab === 'reactivate' && (
                            <ReactivateTab
                                realtorId={realtorId}
                                leads={leads}
                                onUpdateLead={handleUpdateLead}
                            />
                        )}

                        {activeTab === 'tasks' && (
                            <TaskBoard
                                realtorId={realtorId}
                                tasks={tasks}
                                leads={leads}
                                reminderRules={reminderRules}
                                onTasksUpdated={handleRefreshTasks}
                                onUpdateRule={(ruleId, updates) => {
                                    // Local-only update to allow "Discard" to work
                                    setReminderRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r));
                                }}
                                onSaveRules={async () => {
                                    console.log(`[ClientHub] Starting to save ${reminderRules.length} rules to database...`);

                                    let successCount = 0;
                                    let errorCount = 0;
                                    const errors: string[] = [];

                                    for (const rule of reminderRules) {
                                        try {
                                            const result = await updateReminderRule(rule.id, rule);
                                            if (result) {
                                                successCount++;
                                            } else {
                                                errorCount++;
                                                errors.push(`Rule ${rule.id}: Update returned false`);
                                            }
                                        } catch (error: any) {
                                            errorCount++;
                                            const errorMsg = error?.message || String(error);
                                            errors.push(`Rule ${rule.id}: ${errorMsg}`);
                                            console.error(`[ClientHub] Failed to save rule ${rule.id}:`, error);
                                        }
                                    }

                                    if (errorCount > 0) {
                                        console.error(`[ClientHub] Save completed with errors: ${successCount} succeeded, ${errorCount} failed`);
                                        console.error('[ClientHub] Error details:', errors);

                                        // Check if it's a permission error
                                        const hasPermissionError = errors.some(e => e.includes('Permission') || e.includes('permission'));
                                        if (hasPermissionError) {
                                            alert(`❌ Save Failed: Firestore Permission Denied\n\n${errorCount} rules could not be saved.\n\nYou need to update Firebase security rules:\n1. Go to Firebase Console\n2. Firestore Database → Rules\n3. Add rules for "reminderRules" collection\n4. See firestore.rules file for details`);
                                        } else {
                                            alert(`❌ Save Failed\n\n${errorCount} rules had errors.\nCheck console for details.`);
                                        }

                                        throw new Error(`Failed to save ${errorCount} rules`);
                                    }

                                    console.log(`[ClientHub] ✅ Successfully saved all ${successCount} rules!`);
                                }}
                            />
                        )}


                        {activeTab === 'settings' && (
                            <StatusSettings
                                realtorId={realtorId}
                            />
                        )}

                        {activeTab === 'profile' && (
                            <ProfileTab
                                profile={realtorProfile}
                                onUpdateProfile={async (updates) => {
                                    if (!realtorId) return;

                                    // Deep merge for optimistic update to prevent wiping out nested fields
                                    setRealtorProfile(prev => {
                                        if (!prev) return null;
                                        const next = { ...prev, ...updates };
                                        if (updates.realtor && prev.realtor) {
                                            next.realtor = { ...prev.realtor, ...updates.realtor };
                                        }
                                        return next;
                                    });

                                    // Forward to parent if provided to keep global header in sync
                                    if (onUpdateProfile) {
                                        onUpdateProfile(updates);
                                    }

                                    // Save to DB
                                    try {
                                        console.log("[ClientHub] Saving profile updates:", updates);
                                        const success = await saveUserProfile(realtorId, updates);
                                        if (!success) {
                                            throw new Error("Database save operation returned false");
                                        }
                                        console.log("[ClientHub] Profile saved successfully to DB");
                                    } catch (err: any) {
                                        console.error("Failed to save profile:", err);
                                        // Re-fetch to ensure sync after failure
                                        const fresh = await getUserProfile(realtorId);
                                        setRealtorProfile(fresh);
                                        alert(`Failed to save profile: ${err.message || 'Unknown error'}`);
                                        throw err; // Propagate to ProfileTab to stop spinner
                                    }
                                }}
                            />
                        )}

                        {activeTab === 'whiteboard' && (
                            <WhiteboardTab userId={realtorId} />
                        )}

                        {activeTab === 'creative_studio' && (
                            <div className="max-w-5xl mx-auto py-8">
                                <CreativeStudioWidget />
                            </div>
                        )}

                        {activeTab === 'best_practices' && (
                            <BestPracticesTab />
                        )}

                        {activeTab === 'guides' && (
                            <GuidesTab onNavigate={onNavigate} />
                        )}

                        {activeTab === 'bulk_prefetch' && (
                            <BulkPrefetchTab />
                        )}

                        {activeTab === 'city_data' && (
                            <CityDataTab onNavigate={onNavigate} />
                        )}

                        {activeTab === 'storage_registry' && (
                            <StorageScannerTab onNavigate={onNavigate} />
                        )}

                    </div>

                    <style dangerouslySetInnerHTML={{
                        __html: `
                @keyframes bounce-slow {
                  0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
                  50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
                }
                .animate-bounce-slow {
                  animation: bounce-slow 4s infinite;
                }
                @keyframes urgent-flash {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.01); opacity: 0.9; background-color: rgba(255, 0, 0, 0.05); }
                }
                .animate-urgent-flash {
                  animation: urgent-flash 1s infinite;
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

                * {
                  scrollbar-width: thin;
                  scrollbar-color: #94a3b8 #f8fafc;
                }
              `
                    }} />
                    <Footer onNavigate={onNavigate} />
                </div>
            </div>

            <AddClientModal
                isOpen={isAddClientModalOpen}
                onClose={() => setIsAddClientModalOpen(false)}
                realtorName={realtorProfile?.displayName || 'Your Realtor'}
                realtorId={realtorId}
            />

            <RemoveClientModal
                isOpen={isRemoveClientModalOpen}
                onClose={() => setIsRemoveClientModalOpen(false)}
                realtorId={realtorId}
                onClientRemoved={() => {
                    // Refresh clients list if needed, or just let the local state in modal handle it
                    // Ideally we should also refresh the main clients list in ClientHub
                    // For now, let's just close or keep open, the modal handles its own list state.
                    // To be perfect, we should trigger a refresh of 'clients' state in ClientHub
                    getRealtorClients(realtorId).then(setClients);
                }}
            />
        </div>
    );
};

export default ClientHub;
