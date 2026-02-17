import React, { useState, useEffect } from 'react';
import { getLeads, getTasks, getTemplates, getCalendarEvents, seedMockData, getReminderRules, getRealtorClients, updateReminderRule } from '../../../services/firebaseService';
import { getInitialMockLeads, getInitialMockTasks, getInitialMockTemplates, getInitialMockTransactions } from '../../../services/mockDataService';
import { getDefaultReminderRules } from '../../../services/reminderRulesService';
import { Lead, CRMTask, CommTemplate, ReminderRule, CalendarEvent, UserProfile } from '../../../types';

export const useHubData = (realtorId: string, activeTab?: string) => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [tasks, setTasks] = useState<CRMTask[]>([]);
    const [templates, setTemplates] = useState<CommTemplate[]>([]);
    const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [clients, setClients] = useState<UserProfile[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [loadingClients, setLoadingClients] = useState(false);

    // Track whether mock seeding has already run (prevents re-seeding on every tab switch)
    const seededRef = React.useRef(false);

    const refreshLeads = async () => {
        const _leads = await getLeads(realtorId, ['leads']);
        setLeads(_leads);
    };

    const refreshTasks = async () => {
        console.log(`[useHubData] Refreshing tasks for realtor: ${realtorId}`);
        const _tasks = await getTasks(realtorId);
        console.log(`[useHubData] Fetched ${_tasks.length} tasks`);
        setTasks(_tasks);
    };

    const refreshClients = async () => {
        setLoadingClients(true);
        const data = await getRealtorClients(realtorId);
        setClients(data);
        setLoadingClients(false);
    };

    useEffect(() => {
        const fetchLeads = async () => {
            if (!realtorId) return;
            setLoadingData(true);
            try {
                console.log(`[useHubData] Fetching Leads...`);
                let _leads = await getLeads(realtorId, ['leads']);

                // Seed Check (only once per session)
                if (!seededRef.current) {
                    const initialLeads: Lead[] = getInitialMockLeads(realtorId);
                    if (_leads.length < 5) {
                        const actualShouldSeed = initialLeads.some(l => !_leads.find(ex => ex.id === l.id));
                        if (actualShouldSeed) {
                            console.log("[useHubData] Seeding mock leads...");
                            const initialTasks = getInitialMockTasks(realtorId);
                            const initialTemplates = getInitialMockTemplates(realtorId);
                            const initialTransactions = getInitialMockTransactions(realtorId);
                            await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates, initialTransactions);
                            _leads = await getLeads(realtorId, ['leads']);
                        }
                    }
                    seededRef.current = true;
                }

                const initialLeads: Lead[] = getInitialMockLeads(realtorId);
                const mappedLeads = _leads.map(lead => {
                    if (lead.isMock) {
                        const mockTemplate = initialLeads.find(l => l.id === lead.id);
                        if (mockTemplate) return { ...mockTemplate, ...lead };
                    }
                    return lead;
                });

                setLeads(mappedLeads);
            } finally {
                setLoadingData(false);
            }
        };

        const fetchTasks = async () => {
            if (!realtorId) return;
            setLoadingData(true);
            try {
                console.log(`[useHubData] Fetching Tasks...`);
                const _tasks = await getTasks(realtorId);
                setTasks(_tasks);
            } finally {
                setLoadingData(false);
            }
        };

        const fetchExtendedData = async () => {
            if (!realtorId) return;

            // Calendar Events
            if (activeTab === 'calendar' || activeTab === 'leads') {
                getCalendarEvents(realtorId).then(evs => setCalendarEvents(evs));
            }

            // Templates
            if (activeTab === 'tasks' || activeTab === 'creative_studio') {
                getTemplates(realtorId).then(ts => setTemplates(ts));
            }

            // Reminder Rules
            if (activeTab === 'reminder_rules' || activeTab === 'reactivate') {
                getReminderRules(realtorId).then(dbRules => {
                    const appRules = getDefaultReminderRules().map(rule => ({ ...rule, realtorId }));
                    const merged = appRules.map(ar => {
                        const dr = dbRules.find(r => r.id === ar.id);
                        return dr ? { ...ar, ...dr } : ar;
                    });
                    setReminderRules(merged);
                });
            }

            // Clients
            if (activeTab === 'clients') {
                refreshClients();
            }
        };

        // Lead fetching logic
        const needsLeads = ['leads', 'clients', 'closing', 'reactivate', 'calendar'].includes(activeTab || '');
        if (needsLeads) {
            fetchLeads();
        }

        // Task fetching logic
        const needsTasks = ['tasks', 'calendar'].includes(activeTab || '');
        if (needsTasks) {
            fetchTasks();
        }

        fetchExtendedData();
    }, [realtorId, activeTab]);

    const saveReminderRules = async () => {
        console.log(`[useHubData] Starting to save ${reminderRules.length} rules...`);
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const rule of reminderRules) {
            try {
                const result = await updateReminderRule(rule.id, rule);
                if (result) successCount++;
                else {
                    errorCount++;
                    errors.push(`Rule ${rule.id}: Update returned false`);
                }
            } catch (error: any) {
                errorCount++;
                errors.push(`Rule ${rule.id}: ${error?.message || String(error)}`);
            }
        }

        if (errorCount > 0) {
            console.error(`[useHubData] Save completed with errors: ${successCount} succeeded, ${errorCount} failed`, errors);
            if (errors.some(e => e.includes('Permission'))) {
                alert(`❌ Save Failed: Permission Denied. Check Firestore rules.`);
            } else {
                alert(`❌ Save Failed\n\n${errorCount} rules had errors.`);
            }
            throw new Error(`Failed to save ${errorCount} rules`);
        }
        console.log(`[useHubData] ✅ Successfully saved all ${successCount} rules!`);
    };

    return {
        leads, setLeads, refreshLeads,
        tasks, setTasks, refreshTasks,
        templates,
        reminderRules, setReminderRules,
        calendarEvents,
        clients, setClients, refreshClients,
        loadingData,
        loadingClients,
        saveReminderRules
    };
};
