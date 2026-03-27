
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
if (admin.apps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function seedLeadStory() {
    const realtorId = 'tMu3tKst5KRoOzIREG8yXjQNeo32'; // agent@fc.com
    const clientId = 'qXW4SQYYf2McP2eGZt1n9fa79Yc2'; // buyer@fc.com
    
    console.log(`Seeding lead story for ${clientId} under realtor ${realtorId}...`);
    
    const storyChapters = {
        chapter01: "Venture Capitalist looking for a high-density, modern residence in Silicon Valley or San Francisco. Busy lifestyle, frequently traveling for board meetings.",
        chapter02: "Morning espresso followed by virtual meetings. I need a space that feels like a quiet sanctuary yet is connected to the tech pulse.",
        chapter03: "Minimalist, high-end architecture. Glass walls, open plan, and a dedicated space for a podcast studio. Vastu-compliant north orientation is preferred.",
        chapter04: "Proximity to Sand Hill Road and SF networking hubs. High-speed fiber connectivity is a non-negotiable requirement. LEED certification preferred."
    };
    
    const fullStory = Object.values(storyChapters).join('\n\n');
    
    const leadData = {
        id: clientId,
        realtorId: realtorId,
        email: 'buyer@fc.com',
        fullName: 'VC Buyer Test',
        firstName: 'VC Buyer',
        lastName: 'Test',
        funnelStage: 'Active Search',
        status: 'Active',
        leadType: 'Buyer',
        health: 'Healthy',
        engagementScore: 'Hot',
        source: 'Direct',
        motivation: fullStory,
        // Store explicit chapters for pre-filling the story tab
        storyChapters: storyChapters,
        motivationHistory: [
            {
                story: "Initial inquiry: Looking for a modern condo in Palo Alto.",
                timestamp: admin.firestore.Timestamp.now()
            }
        ],
        searchCriteria: {
            locations: 'San Francisco, Palo Alto, Menlo Park',
            budgetMax: '5000000',
            personaProfile: 'High Net Worth / Tech Executive'
        },
        financialVitals: {
            budgetMax: '5000000',
            preApprovalStatus: true,
            isAllCash: true
        },
        leadInfo: {
            customerMessage: fullStory,
            origin: 'My Story',
            atmosphericAnchors: ['White Glove Service', 'Home Office Ready', 'High ROI Potential', 'Private / Gated']
        },
        receivedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    };
    
    // 1. Create/Update the lead document
    await db.collection('realtors').doc(realtorId).collection('leads').doc(clientId).set(leadData, { merge: true });
    
    // 2. Also update the user's principal record to ensure they know their role and agent
    await db.collection('users').doc(clientId).update({
        realtorId: realtorId,
        role: 'buyer'
    });
    
    console.log('Successfully seeded lead story and updated user profile.');
}

seedLeadStory().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
