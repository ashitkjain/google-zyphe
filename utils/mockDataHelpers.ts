/**
 * Helper function to create mock inbound messages for testing
 * Can be called from browser console or imported in a component
 */

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase/config';

export const createMockInboundMessages = async (realtorId: string) => {
    if (!db) {
        console.error('Database not initialized');
        return;
    }

    const mockMessages = [
        {
            message_id: `mock-inbound-${Date.now()}-001`,
            lead_id: 'lead-sarah-miller-123',
            lead_name: 'Sarah Miller',
            realtorId,
            channel: 'sms',
            content: "Thanks for checking in! We are actually looking to restart our search next month. Can we schedule a call?",
            reply_received: false,
            sentiment: 'positive',
            isInbound: true,
            thread_id: `thread-sarah-${realtorId}`,
            parent_message_id: 'msg-day1-sarah',
            requires_action: true,
        },
        {
            message_id: `mock-inbound-${Date.now()}-002`,
            lead_id: 'lead-mike-johnson-456',
            lead_name: 'Mike Johnson',
            realtorId,
            channel: 'email',
            content: "What are the current rates for a 30-year fixed? Also, do you have any listings in the downtown area?",
            reply_received: false,
            sentiment: 'question',
            isInbound: true,
            thread_id: `thread-mike-${realtorId}`,
            parent_message_id: 'msg-day1-mike',
            requires_action: true,
        },
        {
            message_id: `mock-inbound-${Date.now()}-003`,
            lead_id: 'lead-jennifer-davis-789',
            lead_name: 'Jennifer Davis',
            realtorId,
            channel: 'sms',
            content: "Hi! Yes, I'm still interested. My budget has increased to $850k. Do you have anything available?",
            reply_received: false,
            sentiment: 'positive',
            isInbound: true,
            thread_id: `thread-jennifer-${realtorId}`,
            parent_message_id: 'msg-day1-jennifer',
            requires_action: true,
        },
        {
            message_id: `mock-inbound-${Date.now()}-004`,
            lead_id: 'lead-robert-chen-321',
            lead_name: 'Robert Chen',
            realtorId,
            channel: 'email',
            content: "Not interested at this time. Please remove me from your list.",
            reply_received: false,
            sentiment: 'negative',
            isInbound: true,
            thread_id: `thread-robert-${realtorId}`,
            parent_message_id: 'msg-day1-robert',
            requires_action: true,
        }
    ];

    console.log('🌱 Creating mock inbound messages...');

    try {
        for (const message of mockMessages) {
            const docRef = doc(db, 'reactivation_messages', message.message_id);
            await setDoc(docRef, {
                ...message,
                sent_at: serverTimestamp()
            });
            console.log(`✅ Created message from ${message.lead_name}`);
        }

        console.log('✨ Successfully created all mock messages!');
        console.log('🔄 Refresh the page to see them in Action Required widget');

        return { success: true, count: mockMessages.length };
    } catch (error) {
        console.error('❌ Error creating mock messages:', error);
        return { success: false, error };
    }
};

// Export for use in browser console
if (typeof window !== 'undefined') {
    (window as any).createMockInboundMessages = createMockInboundMessages;
}
