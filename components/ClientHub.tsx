import React, { useState, useEffect } from 'react';
import { getLeads, getTasks, getTemplates, seedMockData, saveUserProfile, getUserProfile, updateLead, getReminderRules, updateReminderRule, deleteAllMockData, getRealtorClients } from '../services/firebaseService';
import { getInitialMockLeads, getInitialMockTasks, getInitialMockTemplates, getInitialMockTransactions } from '../services/mockDataService';
import { getDefaultReminderRules } from '../services/reminderRulesService';
import { UserProfile, Lead, CRMTask, CommTemplate, FunnelStage, ReminderRule, LeadNote } from '../types';
import { DropResult } from '@hello-pangea/dnd';
import Logo from './Logo';
import LeadsList from './LeadsList';

// Sub-components
import ClientDetailsView from './client-hub/ClientDetailsView';
import TaskBoard from './client-hub/TaskBoard';
import StatusSettings from './client-hub/StatusSettings';
import { StatusOption } from '../types';
import { isTerminalStatus, getFunnelStageForStatus, getStatusOptions } from '../services/statusService';
import WhiteboardTab from './client-hub/WhiteboardTab';
import ClosingDashboard from './client-hub/ClosingDashboard';
import BestPracticesTab from './client-hub/BestPracticesTab';
import ReactivateTab from './client-hub/ReactivateTab';
import Footer from './Footer';

interface Props {
    realtorId: string;
    realtorName: string;
    onSignOut: () => void;
    onBack: () => void;
}

const generateClientID = () => {
    return 'C-' + Math.random().toString(36).substring(2, 7).toUpperCase();
};

type HubTab = 'leads' | 'tasks' | 'settings' | 'whiteboard' | 'closing' | 'reactivate' | 'best_practices' | 'clients';

const ClientHub: React.FC<Props> = ({ realtorId, realtorName, onSignOut, onBack }) => {
    const [activeTab, setActiveTab] = useState<HubTab>('leads');
    const [realtorProfile, setRealtorProfile] = useState<UserProfile | null>(null);
    const [settingsSubTab, setSettingsSubTab] = useState<'statuses' | 'properties'>('statuses');

    const [clients, setClients] = useState<UserProfile[]>([]);
    const [loadingClients, setLoadingClients] = useState(true);
    const [explicitlySelectedClientId, setExplicitlySelectedClientId] = useState<string | undefined>(undefined);



    const [leads, setLeads] = useState<Lead[]>([]);
    const [tasks, setTasks] = useState<CRMTask[]>([]);
    const [templates, setTemplates] = useState<CommTemplate[]>([]);
    const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
    const [loadingData, setLoadingData] = useState(true);


    const [pendingNote, setPendingNote] = useState<{ leadId: string, color: string } | null>(null);

    const [resetLogs, setResetLogs] = useState<string[]>([]);
    const [isResetting, setIsResetting] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);


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
            const initialLeads: Lead[] = getInitialMockLeads();
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
            const profile = await getUserProfile(realtorId);
            setRealtorProfile(profile);
        };
        fetchRealtorProfile();
    }, [realtorId]);

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
                const newStage = getFunnelStageForStatus(updates.status, currentLead.leadType, realtorProfile?.settings) as any;
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

            if (isTerminalStatus(updates.status || '', currentLead.leadType, realtorProfile?.settings) && !isTerminalStatus(currentLead.status, currentLead.leadType, realtorProfile?.settings)) {
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

    const tabs: { id: HubTab; label: string; icon: string }[] = [
        { id: 'leads', label: 'Funnel', icon: 'fa-bullseye' },
        { id: 'closing', label: 'Closing', icon: 'fa-file-invoice-dollar' },
        { id: 'reactivate', label: 'Reactivate', icon: 'fa-bolt' },
        { id: 'clients', label: 'Clients', icon: 'fa-user-group' },
        { id: 'tasks', label: 'Tasks', icon: 'fa-check-double' },
        { id: 'whiteboard', label: 'Whiteboard', icon: 'fa-pen-to-square' },
        { id: 'settings', label: 'Data Fields', icon: 'fa-sliders' },
        { id: 'best_practices', label: 'Best Practices', icon: 'fa-book-open' },
    ];



    const handleUpdateStatuses = async (statuses: StatusOption[]) => {
        const success = await saveUserProfile(realtorId, {
            settings: {
                ...realtorProfile?.settings,
                leadStatuses: statuses
            }
        });

        if (success === true) {
            setRealtorProfile(prev => prev ? {
                ...prev,
                settings: {
                    ...prev.settings,
                    leadStatuses: statuses
                }
            } : null);
        }
    };

    const handleUpdateProperties = async (properties: any[]) => {
        const success = await saveUserProfile(realtorId, {
            settings: {
                ...realtorProfile?.settings,
                leadProperties: properties
            }
        });

        if (success === true) {
            setRealtorProfile(prev => prev ? {
                ...prev,
                settings: {
                    ...prev.settings,
                    leadProperties: properties
                }
            } : null);
        }
    }


    const handleResetMockData = async () => {
        setShowResetConfirm(false);
        setIsResetting(true);
        setResetLogs(["[System] Initializing database reset..."]);

        const addLog = (msg: string) => {
            setResetLogs(prev => [...prev, msg].slice(-20)); // Keep last 20
        };

        try {
            // 1. Delete existing data
            await deleteAllMockData(realtorId, addLog);

            // 2. Generate and seed new data immediately
            addLog("[System] Generating mock objects...");
            const initialLeads = getInitialMockLeads();
            const initialTasks = getInitialMockTasks(realtorId);
            const initialTemplates = getInitialMockTemplates(realtorId);
            const initialTransactions = getInitialMockTransactions(realtorId);

            // 3. Wait for seeding to complete
            await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates, initialTransactions, addLog);

            addLog("[System] Database Reset Complete. You can now browse the updated data.");
        } catch (error) {
            console.error("Error resetting data:", error);
            addLog(`[Error] ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsResetting(false);
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

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col">
                    <div className="flex flex-col">
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
                                onUpdateLead={(id, updates) => handleUpdateLead(id, updates)}
                                onCreateLead={handleCreateLead}
                                pendingNote={pendingNote}
                                setPendingNote={setPendingNote}
                                handleSaveNote={handleSaveLeadNote}
                                handleUpdateNote={handleUpdateLeadNote}
                                handleDeleteNote={handleDeleteLeadNote}
                                handleDragEnd={handleDragEnd}
                                realtorSettings={realtorProfile?.settings}
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
                                onUpdateSettings={async (settings) => {
                                    const success = await saveUserProfile(realtorId, {
                                        settings: {
                                            ...realtorProfile?.settings,
                                            ...settings
                                        }
                                    });
                                    if (success) {
                                        setRealtorProfile(prev => prev ? {
                                            ...prev,
                                            settings: {
                                                ...prev.settings,
                                                ...settings
                                            }
                                        } : null);
                                    }
                                }}
                                onTabChange={(tab: any) => {
                                    if (tab === 'settings:properties') {
                                        setSettingsSubTab('properties');
                                        setActiveTab('settings');
                                    } else if (tab !== 'Buyer' && tab !== 'Buyer2' && tab !== 'Seller') {
                                        setActiveTab(tab);
                                    }
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
                                onUpdateStatuses={handleUpdateStatuses}
                                onUpdateProperties={handleUpdateProperties}
                                initialStatuses={realtorProfile?.settings?.leadStatuses}
                                initialProperties={realtorProfile?.settings?.leadProperties}
                                onResetData={() => setShowResetConfirm(true)}
                                resetLogs={resetLogs}
                                isResetting={isResetting}
                                defaultTab={settingsSubTab}
                            />
                        )}

                        {activeTab === 'whiteboard' && (
                            <WhiteboardTab userId={realtorId} />
                        )}

                        {activeTab === 'best_practices' && (
                            <BestPracticesTab />
                        )}

                    </div>






                    {/* Reset Confirmation Modal */}
                    {showResetConfirm && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                            <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
                                <div className="p-10 text-center">
                                    <div className="w-20 h-20 rounded-3xl bg-rose-50 flex items-center justify-center mb-8 mx-auto">
                                        <i className="fa-solid fa-triangle-exclamation text-3xl text-rose-500"></i>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Factory Reset</h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                        This will delete all mock leads, tasks, and transactions and regenerate the default demo data. <span className="text-rose-600 font-bold">This cannot be undone.</span>
                                    </p>
                                </div>
                                <div className="p-8 bg-slate-50 flex flex-col gap-3">
                                    <button
                                        onClick={handleResetMockData}
                                        className="w-full py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-600/20 active:scale-[0.98] transition-all"
                                    >
                                        Confirm Reset
                                    </button>
                                    <button
                                        onClick={() => setShowResetConfirm(false)}
                                        className="w-full py-4 bg-white text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:text-slate-600 hover:bg-slate-100 transition-all"
                                    >
                                        Cancel
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
                    <Footer />
                </div>
            </div>
        </div>
    );
};

export default ClientHub;
