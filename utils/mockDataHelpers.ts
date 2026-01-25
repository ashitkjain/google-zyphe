import { collection, doc, setDoc, getDocs, query, where, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase/config';

export const createMockReactivationData = async (realtorId: string) => {
    if (!db) {
        console.error('Database not initialized');
        return { success: false, error: 'DB not initialized' };
    }

    console.log('🧹 Cleaning up old mock data...');

    try {
        // 1. Delete existing mock lead plans and messages
        const collectionsToClean = [
            { name: 'lead_plans', idField: 'userId' },
            { name: 'reactivation_messages', idField: 'realtorId' }
        ];

        for (const col of collectionsToClean) {
            const q = query(
                collection(db, col.name),
                where(col.idField, '==', realtorId)
            );
            const snap = await getDocs(q);
            const mockDocs = snap.docs.filter(d => d.data().isMock === true);
            const deletePromises = mockDocs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);
            console.log(`🗑️ Deleted ${mockDocs.length} mock records from ${col.name}`);
        }

        const now = new Date();
        const sixDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 6);
        const twoDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2);
        const oneHourAgo = new Date(now.getTime() - 1000 * 60 * 60 * 1);

        // 2. Mock Lead Plans
        const mockPlans = [
            {
                id: 'mock-plan-pursuing-overdue',
                lead_id: 'lead-overdue-1',
                lead_name: 'Overdue Oliver',
                market: 'Seattle, WA',
                priority_score: 0.95,
                userId: realtorId,
                reactivation_analysis_summary_id: 'mock-summary',
                isMock: true,
                reactivation_status: 'pursuing',
                statusUpdatedOn: sixDaysAgo,
                sequence: {
                    enabled: true,
                    steps: [
                        { day_offset: 5, channel: 'sms', message: 'Hey Oliver, just seeing if you had a chance to check those inventory updates?' }
                    ]
                }
            },
            {
                id: 'mock-plan-responded',
                lead_id: 'lead-responded-2',
                lead_name: 'Replied Rita',
                market: 'Bellevue, WA',
                priority_score: 0.88,
                userId: realtorId,
                reactivation_analysis_summary_id: 'mock-summary',
                isMock: true,
                reactivation_status: 'pursuing',
                statusUpdatedOn: twoDaysAgo,
                sequence: {
                    enabled: true,
                    steps: [{ day_offset: 7, channel: 'email', message: 'Checking in...' }]
                }
            },
            {
                id: 'mock-plan-suggested',
                lead_id: 'lead-suggested-3',
                lead_name: 'Suggested Sam',
                market: 'Tacoma, WA',
                priority_score: 0.65,
                userId: realtorId,
                reactivation_analysis_summary_id: 'mock-summary',
                isMock: true,
                reactivation_status: 'suggested',
                statusUpdatedOn: now,
                recommended_channel: 'sms',
                tone: 'friendly',
                staleness_reason: 'inventory',
                first_touch: {
                    send_after_days: 1,
                    message: "Hi Sam, inventory is finally picking up in Tacoma. Want to see current listings?"
                },
                sequence: { enabled: true, steps: [] }
            },
            {
                id: 'mock-plan-ignored',
                lead_id: 'lead-ignored-4',
                lead_name: 'Ignored Ian',
                market: 'Renton, WA',
                priority_score: 0.45,
                userId: realtorId,
                reactivation_analysis_summary_id: 'mock-summary',
                isMock: true,
                reactivation_status: 'not_pursuing',
                statusUpdatedOn: now,
                recommended_channel: 'email',
                tone: 'low_pressure',
                staleness_reason: 'timing',
                first_touch: {
                    send_after_days: 1,
                    message: "Hi Ian, just checking if the timing is better now."
                },
                sequence: {
                    enabled: true,
                    steps: [{ day_offset: 1, channel: 'sms', message: 'You will never see this.' }]
                }
            }
        ];

        // 3. Mock Messages
        const mockMessages = [
            // Lead 1: Day 1 sent 6 days ago (overdue for day 5)
            {
                message_id: 'msg-overdue-day1',
                lead_id: 'lead-overdue-1',
                lead_name: 'Overdue Oliver',
                realtorId,
                userId: realtorId,
                content: 'Hi Oliver, I noticed some new homes in Seattle...',
                sent_at: Timestamp.fromDate(sixDaysAgo),
                isInbound: false,
                isMock: true,
                thread_id: 'thread-overdue',
                requires_action: false
            },
            // Lead 2: Day 1 sent 2 days ago, Lead replied 1 hour ago
            {
                message_id: 'msg-responded-day1',
                lead_id: 'lead-responded-2',
                lead_name: 'Replied Rita',
                realtorId,
                userId: realtorId,
                content: 'Hi Rita, checking in on Bellevue market.',
                sent_at: Timestamp.fromDate(twoDaysAgo),
                isInbound: false,
                isMock: true,
                thread_id: 'thread-responded',
                requires_action: false
            },
            {
                message_id: 'msg-responded-reply',
                lead_id: 'lead-responded-2',
                lead_name: 'Replied Rita',
                realtorId,
                userId: realtorId,
                content: 'Yes, I am still looking! Can you send me listings?',
                sent_at: Timestamp.fromDate(oneHourAgo),
                isInbound: true,
                isMock: true,
                thread_id: 'thread-responded',
                requires_action: true,
                sentiment: 'positive'
            }
        ];

        console.log('🌱 Creating new mock data...');

        for (const plan of mockPlans) {
            await setDoc(doc(db, 'lead_plans', plan.id), plan);
        }
        for (const msg of mockMessages) {
            await setDoc(doc(db, 'reactivation_messages', msg.message_id), msg);
        }

        console.log('✨ Successfully created mock test suite!');
        return { success: true };

    } catch (error) {
        console.error('❌ Error creating mock data:', error);
        return { success: false, error };
    }
};

// Export for browser console
if (typeof window !== 'undefined') {
    (window as any).createMockReactivationData = createMockReactivationData;
}
