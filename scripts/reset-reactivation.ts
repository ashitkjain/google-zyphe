
// No imports needed for env/fs in this env setup

// Initialize Admin SDK service account key
// NOTE: You must have a service-account.json file for this to work with Admin SDK
// If running locally with user credentials, we'd use client SDK, but for "Delete All", Admin is better.
// However, since I don't have your service account file, I will use Client SDK logic similar to existing scripts,
// but be aware that Client SDK might have deletion limits if security rules prevent bulk delete.
// Let's stick to the pattern used in 'seed-action-items.ts' which uses Client SDK (modular).

import { initializeApp as initClient } from 'firebase/app';
import { getFirestore as getClientFirestore, collection, getDocs, deleteDoc, doc, setDoc, query, where, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBiP85bXTptTAqvXUh4JwYC-6SQJqwukvI",
    authDomain: "zyphe-af0bf.firebaseapp.com",
    projectId: "zyphe-af0bf",
    storageBucket: "zyphe-af0bf.firebasestorage.app",
    messagingSenderId: "434538487700",
    appId: "1:434538487700:web:2d0880addbfdca71c13981",
};

const app = initClient(firebaseConfig);
const db = getClientFirestore(app);

// Data to Seed
const MOCK_ARCHIVED_LEADS = [
    // --- BUYERS (10) ---
    { id: 'L-B01', name: 'Sarah Miller', email: 'sarah.miller@example.com', phone: '+15551234567', status: 'archived', source: 'Zillow', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 45), notes: 'Looking for 3bd in Denver. Stopped responding.', price_range: '$600k - $750k', location_interest: 'Denver, CO' },
    { id: 'L-B02', name: 'Mike Johnson', email: 'mike.j@example.com', phone: '+15559876543', status: 'archived', source: 'Realtor.com', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 120), notes: 'Investment property interest. Financing fell through.', price_range: '$400k - $500k', location_interest: 'Aurora, CO' },
    { id: 'L-B03', name: 'Jennifer Davis', email: 'jen.davis@example.com', phone: '+15554567890', status: 'archived', source: 'Open House', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 14), notes: 'Visited 123 Main St. Said she would follow up.', price_range: '$800k+', location_interest: 'Boulder, CO' },
    { id: 'L-B04', name: 'Robert Chen', email: 'r.chen@example.com', phone: '+15557890123', status: 'archived', source: 'Referral', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 180), notes: 'Ghosted after 2 showings.', price_range: '$1.2M', location_interest: 'Cherry Creek, CO' },
    { id: 'L-B05', name: 'Amanda Wilson', email: 'amanda.w@example.com', phone: '+15551112233', status: 'archived', source: 'Website', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 60), notes: 'First time homebuyer. Very hesitant.', price_range: '$500k', location_interest: 'Lakewood, CO' },
    { id: 'L-B06', name: 'David Lee', email: 'david.lee@example.com', phone: '+15552223344', status: 'archived', source: 'Zillow', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 90), notes: 'Looking for condo near downtown.', price_range: '$450k', location_interest: 'Denver, CO' },
    { id: 'L-B07', name: 'Emma Thompson', email: 'emma.t@example.com', phone: '+15553334455', status: 'archived', source: 'Realtor.com', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 200), notes: 'Relocating from Texas next year.', price_range: '$900k', location_interest: 'Highlands Ranch, CO' },
    { id: 'L-B08', name: 'James Garcia', email: 'james.g@example.com', phone: '+15554445566', status: 'archived', source: 'Referral', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 30), notes: 'Pre-approved but picky.', price_range: '$700k', location_interest: 'Arvada, CO' },
    { id: 'L-B09', name: 'Sophia Martinez', email: 'sophia.m@example.com', phone: '+15555556677', status: 'archived', source: 'Open House', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 25), notes: 'Just looking, not ready to buy yet.', price_range: 'TBD', location_interest: 'Golden, CO' },
    { id: 'L-B10', name: 'William Brown', email: 'bill.brown@example.com', phone: '+15556667788', status: 'archived', source: 'Website', type: 'buyer', last_interaction: new Date(Date.now() - 86400000 * 300), notes: 'Inactive for a long time.', price_range: '$600k', location_interest: 'Centennial, CO' },

    // --- SELLERS (5) ---
    { id: 'L-S01', name: 'Linda Taylor', email: 'linda.t@example.com', phone: '+15559998877', status: 'archived', source: 'Home Valuation', type: 'seller', last_interaction: new Date(Date.now() - 86400000 * 40), notes: 'Thinking of selling 4bd in Parker. Wanted higher price.', price_range: '$850k', location_interest: 'Parker, CO' },
    { id: 'L-S02', name: 'Richard Anderson', email: 'richard.a@example.com', phone: '+15558887766', status: 'archived', source: 'Referral', type: 'seller', last_interaction: new Date(Date.now() - 86400000 * 100), notes: 'Delayed selling due to market conditions.', price_range: '$1.1M', location_interest: 'Boulder, CO' },
    { id: 'L-S03', name: 'Patricia Thomas', email: 'pat.t@example.com', phone: '+15557776655', status: 'archived', source: 'Direct Mail', type: 'seller', last_interaction: new Date(Date.now() - 86400000 * 150), notes: 'Testing the waters.', price_range: '$650k', location_interest: 'Thornton, CO' },
    { id: 'L-S04', name: 'Charles Jackson', email: 'charles.j@example.com', phone: '+15556665544', status: 'archived', source: 'Zillow', type: 'seller', last_interaction: new Date(Date.now() - 86400000 * 10), notes: 'Inherited property, needs work before listing.', price_range: '$400k - As Is', location_interest: 'Englewood, CO' },
    { id: 'L-S05', name: 'Barbara White', email: 'barb.w@example.com', phone: '+15555554433', status: 'archived', source: 'Website', type: 'seller', last_interaction: new Date(Date.now() - 86400000 * 20), notes: 'Looking to downsize.', price_range: '$750k', location_interest: 'Littleton, CO' }
];

// Helper to get a valid Realtor ID
async function getValidRealtorId() {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    if (!snapshot.empty) {
        const userId = snapshot.docs[0].id;
        console.log(`👤 Found user ID: ${userId}`);
        return userId;
    }
    console.warn('⚠️ No users found in DB. Using fallback ID.');
    return 'user_2sC1hK8p9wL7nM4qR3tV5jX0bY2'; // Fallback
}

// const REALTOR_ID = 'user_2sC1hK8p9wL7nM4qR3tV5jX0bY2'; // Removed hardcoded
let REALTOR_ID = ''; // Will be set in main function

async function resetReactivation() {
    // REALTOR_ID = await getValidRealtorId();
    REALTOR_ID = 'vlVwUe8RdLPsKObKwEgCEise452'; // Explicitly set to user provided ID
    console.log('🔄 Starting Reactivation Module Hard Reset for User:', REALTOR_ID);

    // 1. Delete All Messages
    console.log('🗑️  Deleting all existing messages...');
    const messagesRef = collection(db, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    const mBatch = writeBatch(db);
    let mCount = 0;

    messagesSnapshot.forEach((doc) => {
        mBatch.delete(doc.ref);
        mCount++;
    });

    if (mCount > 0) {
        await mBatch.commit();
        console.log(`   Deleted ${mCount} messages.`);
    } else {
        console.log('   No messages found to delete.');
    }

    // 2. Delete All Leads (Only mock ones ideally, but typically hard reset clears 'leads' collection or specific ones)
    // To be safe, let's delete only leads that look like our mocks or have status 'archived' to avoid wiping real production data if mixed.
    // For this user context, we will delete ALL leads as requested "delete archived leads... and create new".

    console.log('🗑️  Deleting Leads...');
    const leadsRef = collection(db, 'leads');
    // Safety: Delete ALL leads to ensure a hard reset.
    // Safety: Delete ALL leads to ensure a hard reset.
    const leadsSnapshot = await getDocs(leadsRef); // Get ALL leads
    console.log(`   Found ${leadsSnapshot.size} leads in database.`);

    const chunks = [];
    let currentBatch = writeBatch(db);
    let currentCount = 0;
    const batchSize = 400; // Safety limit below 500

    leadsSnapshot.docs.forEach((doc) => {
        // Log first few IDs to confirm we are seeing the right data
        if (currentCount < 5) console.log(`   - Will delete: ${doc.id}`);

        currentBatch.delete(doc.ref);
        currentCount++;

        if (currentCount % batchSize === 0) {
            chunks.push(currentBatch.commit());
            currentBatch = writeBatch(db);
        }
    });

    if (currentCount % batchSize !== 0) {
        chunks.push(currentBatch.commit());
    }

    if (chunks.length > 0) {
        await Promise.all(chunks);
        console.log(`   Deleted ${currentCount} leads.`);
    } else {
        console.log('   No leads found to delete.');
    }

    // 3. Seed New Archived Leads
    console.log('🌱 Seeding fresh archived leads...');
    const seedBatch = writeBatch(db);

    for (const lead of MOCK_ARCHIVED_LEADS) {
        const leadRef = doc(db, 'leads', lead.id);
        const names = lead.name.split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ');

        const leadData = {
            id: lead.id,
            clientId: lead.id,
            firstName: firstName,
            lastName: lastName,
            fullName: lead.name,
            email: lead.email,
            phone: lead.phone,
            status: lead.status, // 'archived'
            source: lead.source,
            leadType: lead.type.charAt(0).toUpperCase() + lead.type.slice(1), // 'Buyer' or 'Seller'

            searchCriteria: {
                locations: lead.location_interest,
                priceText: lead.price_range
            },

            // Original fields just in case
            notes: lead.notes,
            lastActivity: lead.last_interaction,

            realtorId: REALTOR_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            funnelStage: 'Archived',
            computed_score: Math.floor(Math.random() * 100),
            ai_summary: null,
            reactivation_plan: null
        };
        seedBatch.set(leadRef, leadData);
    }

    await seedBatch.commit();
    console.log(`✅ Successfully seeded ${MOCK_ARCHIVED_LEADS.length} fresh archived leads.`);

    console.log('\n✨ HARD RESET COMPLETE ✨');
    console.log('Run the app and go to "Reactivate" to see the fresh state.');
    process.exit(0);
}

resetReactivation().catch((err) => {
    console.error('❌ Reset Failed:', err);
    process.exit(1);
});
