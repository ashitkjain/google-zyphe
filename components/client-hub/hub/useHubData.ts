import React, { useState, useEffect } from 'react';
import { getLeads, getTasks, getTemplates, getCalendarEvents, seedMockData, getReminderRules, getRealtorClients, updateReminderRule } from '../../../services/firebaseService';
import { getInitialMockLeads, getInitialMockTasks, getInitialMockTemplates, getInitialMockTransactions } from '../../../services/mockDataService';
import { getDefaultReminderRules } from '../../../services/reminderRulesService';
import { Lead, CRMTask, CommTemplate, ReminderRule, CalendarEvent, UserProfile } from '../../../types';

export const useHubData = (realtorId: string) => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [tasks, setTasks] = useState<CRMTask[]>([]);
    const [templates, setTemplates] = useState<CommTemplate[]>([]);
    const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [clients, setClients] = useState<UserProfile[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [loadingClients, setLoadingClients] = useState(true);

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
        const initializeHubData = async () => {
            setLoadingData(true);

            // 1. Fetch Existing Data
            let _leads = await getLeads(realtorId, ['leads']);
            let _tasks = await getTasks(realtorId);
            let _templates = await getTemplates(realtorId);
            let _events = await getCalendarEvents(realtorId);

            // 2. Load reminder rules
            const appRules = getDefaultReminderRules().map(rule => ({
                ...rule,
                realtorId
            }));
            let dbRules = await getReminderRules(realtorId);
            const mergedRules = appRules.map(appRule => {
                const dbRule = dbRules.find(r => r.id === appRule.id);
                return dbRule ? { ...appRule, ...dbRule } : appRule;
            });
            setReminderRules(mergedRules);

            // 3. Seed Mock Data if necessary
            const initialLeads: Lead[] = getInitialMockLeads(realtorId);
            const shouldSeed = initialLeads.some(l => {
                const existing = _leads.find(ex => ex.id === l.id);
                if (!existing) return true;
                if (l.collectionName && existing.collectionName !== l.collectionName) return true;
                return false;
            });

            if (shouldSeed) {
                const initialTasks = getInitialMockTasks(realtorId);
                const initialTemplates = getInitialMockTemplates(realtorId);
                const initialTransactions = getInitialMockTransactions(realtorId);
                await seedMockData(realtorId, initialLeads, initialTasks, initialTemplates, initialTransactions);

                _leads = await getLeads(realtorId, ['leads']);
                _tasks = await getTasks(realtorId);
                _templates = await getTemplates(realtorId);
                _events = await getCalendarEvents(realtorId);
            }

            const finalLeads = _leads.map(lead => {
                if (lead.isMock) {
                    const mockTemplate = initialLeads.find(l => l.id === lead.id);
                    if (mockTemplate) return { ...mockTemplate, ...lead };
                }
                return lead;
            });

            setLeads(finalLeads);
            setTasks(_tasks);
            setTemplates(_templates);
            setCalendarEvents(_events);
            setLoadingData(false);
        };

        if (realtorId) {
            initializeHubData();
            refreshClients();
        }
    }, [realtorId]);

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
