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
    const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

    const refreshLeads = async () => {
        const _leads = await getLeads(realtorId, ['leads']);
        setLeads(_leads);
    };

    const refreshTasks = async () => {
        const _tasks = await getTasks(realtorId);
        setTasks(_tasks);
    };

    const refreshClients = async () => {
        setLoadingClients(true);
        const data = await getRealtorClients(realtorId);
        setClients(data);
        setLoadingClients(false);
    };

    useEffect(() => {
        const fetchCoreData = async () => {
            if (!realtorId || loadedTabs.has('core')) return;
            setLoadingData(true);
            try {
                console.log(`[useHubData] Initializing Core Data (Leads, Tasks)...`);
                const [_leads, _tasks] = await Promise.all([
                    getLeads(realtorId, ['leads']),
                    getTasks(realtorId)
                ]);

                // Seed Check (only if leads is empty or forced)
                const initialLeads: Lead[] = getInitialMockLeads(realtorId);
                const shouldSeed = _leads.length < 5; // Simpler check for speed

                let finalLeads = _leads;
                let finalTasks = _tasks;

                if (shouldSeed) {
                    console.log("[useHubData] New user or empty leads suspected. Checking for seed...");
                    const actualShouldSeed = initialLeads.some(l => !_leads.find(ex => ex.id === l.id));
                    if (actualShouldSeed) {
                        const initialTasks = getInitialMockTasks(realtorId);
                        const initialTemplates = getInitialMockTemplates(realtorId);
                        const initialTransactions = getInitialMockTransactions(realtorId);
                        await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates, initialTransactions);
                        const [reLeads, reTasks] = await Promise.all([
                            getLeads(realtorId, ['leads']),
                            getTasks(realtorId)
                        ]);
                        finalLeads = reLeads;
                        finalTasks = reTasks;
                    }
                }

                const mappedLeads = finalLeads.map(lead => {
                    if (lead.isMock) {
                        const mockTemplate = initialLeads.find(l => l.id === lead.id);
                        if (mockTemplate) return { ...mockTemplate, ...lead };
                    }
                    return lead;
                });

                setLeads(mappedLeads);
                setTasks(finalTasks);
                setLoadedTabs(prev => new Set(prev).add('core'));
            } finally {
                setLoadingData(false);
            }
        };

        const fetchExtendedData = async () => {
            if (!realtorId) return;

            // Calendar Events
            if ((activeTab === 'calendar' || activeTab === 'leads') && !loadedTabs.has('calendar')) {
                getCalendarEvents(realtorId).then(evs => {
                    setCalendarEvents(evs);
                    setLoadedTabs(prev => new Set(prev).add('calendar'));
                });
            }

            // Templates
            if ((activeTab === 'tasks' || activeTab === 'creative_studio') && !loadedTabs.has('templates')) {
                getTemplates(realtorId).then(ts => {
                    setTemplates(ts);
                    setLoadedTabs(prev => new Set(prev).add('templates'));
                });
            }

            // Reminder Rules
            if ((activeTab === 'reminder_rules' || activeTab === 'reactivate') && !loadedTabs.has('rules')) {
                // ... (merge rules logic) ...
                getReminderRules(realtorId).then(dbRules => {
                    const appRules = getDefaultReminderRules().map(rule => ({ ...rule, realtorId }));
                    const merged = appRules.map(ar => {
                        const dr = dbRules.find(r => r.id === ar.id);
                        return dr ? { ...ar, ...dr } : ar;
                    });
                    setReminderRules(merged);
                    setLoadedTabs(prev => new Set(prev).add('rules'));
                });
            }

            // Clients
            if (activeTab === 'clients' && !loadedTabs.has('clients')) {
                refreshClients().then(() => setLoadedTabs(prev => new Set(prev).add('clients')));
            }
        };

        if (activeTab !== 'explore') {
            fetchCoreData();
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
