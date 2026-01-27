/**
 * Script to seed mock inbound messages for Action Required widget testing
 * Run with: npx ts-node scripts/seed-action-items.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Firebase config (same as your app)
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mock inbound messages
const mockInboundMessages = [
    {
        message_id: 'mock-inbound-001',
        lead_id: 'lead-sarah-miller',
        lead_name: 'Sarah Miller',
        realtorId: 'YOUR_REALTOR_ID', // Replace with actual realtor ID
        channel: 'sms',
        content: "Thanks for checking in! We are actually looking to restart our search next month. Can we schedule a call?",
        sent_at: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
        reply_received: false,
        sentiment: 'positive',
        isInbound: true,
        thread_id: 'thread-sarah-001',
        parent_message_id: 'msg-day1-sarah',
        requires_action: true,
        action_completed_at: null
    },
    {
        message_id: 'mock-inbound-002',
        lead_id: 'lead-mike-johnson',
        lead_name: 'Mike Johnson',
        realtorId: 'YOUR_REALTOR_ID', // Replace with actual realtor ID
        channel: 'email',
        content: "What are the current rates for a 30-year fixed? Also, do you have any listings in the downtown area?",
        sent_at: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
        reply_received: false,
        sentiment: 'question',
        isInbound: true,
        thread_id: 'thread-mike-001',
        parent_message_id: 'msg-day1-mike',
        requires_action: true,
        action_completed_at: null
    },
    {
        message_id: 'mock-inbound-003',
        lead_id: 'lead-jennifer-davis',
        lead_name: 'Jennifer Davis',
        realtorId: 'YOUR_REALTOR_ID', // Replace with actual realtor ID
        channel: 'sms',
        content: "Hi! Yes, I'm still interested. My budget has increased to $850k. Do you have anything available?",
        sent_at: new Date(Date.now() - 1000 * 60 * 45), // 45 minutes ago
        reply_received: false,
        sentiment: 'positive',
        isInbound: true,
        thread_id: 'thread-jennifer-001',
        parent_message_id: 'msg-day1-jennifer',
        requires_action: true,
        action_completed_at: null
    },
    {
        message_id: 'mock-inbound-004',
        lead_id: 'lead-robert-chen',
        lead_name: 'Robert Chen',
        realtorId: 'YOUR_REALTOR_ID', // Replace with actual realtor ID
        channel: 'email',
        content: "Not interested at this time. Please remove me from your list.",
        sent_at: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        reply_received: false,
        sentiment: 'negative',
        isInbound: true,
        thread_id: 'thread-robert-001',
        parent_message_id: 'msg-day1-robert',
        requires_action: true,
        action_completed_at: null
    }
];

async function seedActionItems() {
    console.log('🌱 Seeding mock inbound messages...\n');

    try {
        for (const message of mockInboundMessages) {
            // New Schema Mapping
            const docRef = doc(db, 'messages', message.message_id);
            await setDoc(docRef, {
                threadId: message.thread_id,
                senderId: message.lead_id, // Inbound: Sender is Lead
                receiverId: message.realtorId, // Inbound: Receiver is Realtor
                content: message.content,
                channel: message.channel.toUpperCase(), // SMS, EMAIL
                status: 'delivered', // Inbound messages are delivered
                direction: 'inbound',
                timestamp: serverTimestamp(),
                requires_action: true, // Key for Action Items
                // maintain legacy fields if needed for UI mapping until fully refactored
                lead_name: message.lead_name,
                sentiment: message.sentiment
            });
            console.log(`✅ Created message from ${message.lead_name} (${message.channel})`);
        }

        console.log('\n✨ Successfully seeded all mock messages!');
        console.log('\n📝 Next steps:');
        console.log('1. Update YOUR_REALTOR_ID in this script with your actual realtor ID');
        console.log('2. Run the script again if needed');
        console.log('3. Check the Action Required widget in your app\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
}

seedActionItems();
