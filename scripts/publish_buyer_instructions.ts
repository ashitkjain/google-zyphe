
import admin from 'firebase-admin';

const projectId = 'zyphe-af0bf';
const existingApps = admin.apps ?? [];
if (existingApps.length === 0) {
    admin.initializeApp({ projectId });
}
const db = admin.firestore();

async function seedBuyerInstructions() {
    const topicSlug = 'training';
    const slug = 'buyer-instructions';
    const title = 'Buyer Instructions';
    
    const guideContent = {
        "introduction": "Discover properties using natural language stories. Users can share their details on who they are, what their lifestyle and needs are, and then let AI discover matching homes using nuanced insights. This demo also features an interactive AI Concierge chatbot to answer specific property questions in real-time.",
        "whatThisMeans": { "title": "Step 1: Sign In", "content": "Go to zyphe.ai and click the 'Sign In' button in the header. Login using your provided buyer credentials." },
        "whyThisHappens": { "title": "Step 2: Narrative Search", "content": "Type a life needs story into the 'Find My Match' narrator (e.g., 'Large family moving from the East Coast, need top schools and a quiet street'). Key Insight: The AI extracts filters from words, not just checkboxes." },
        "legalFramework": { "title": "Step 3: Property Overview", "context": "Click on a matching property and review the overview page.", "statutes": [] },
        "timelines": { "title": "Step 4: Sticky Notes", "events": [{ "event": "Leave a Sticky Note", "timeframe": "Instant", "impact": "Drop a note on the property whiteboard (e.g., 'Schools: 9/10, fits perfectly')." }] },
        "whoIsCommonlyInvolved": { "title": "Roles", "roles": [] },
        "resolutionPathway": [
            { "step": 1, "title": "Authentication", "action": "Go to zyphe.ai and click the 'Sign In' button in the header. Login using your provided buyer credentials.", "imageUrl": "/guide-images/signin_step.png" },
            { "step": 2, "title": "Narrative Search", "action": "Type a life needs story into the 'Find My Match' narrator (e.g., 'Large family moving from the East Coast, need top schools and a quiet street').", "imageUrl": "/guide-images/search_step.png" },
            { "step": 3, "title": "Review Scored Results", "action": "See the AI instantly extract filters and score 10-15 matching properties based on your specific story words.", "imageUrl": "/guide-images/results_list_step.png" },
            { "step": 4, "title": "Property Selection", "action": "Click on a high-scoring matching property and review the 'Property DNA' overview page.", "imageUrl": "/guide-images/overview_note_step.png" },
            { "step": 5, "title": "Collaboration", "action": "Leave a Sticky Note on the property whiteboard (e.g., 'Schools: 9/10, fits perfectly').", "imageUrl": "/guide-images/overview_note_step.png" },
            { 
                "step": 6, 
                "title": "Finally.. Explore Property DNA", 
                "action": "Dive deep into specialized analysis tabs:\n1. Interior (finishes & layout)\n2. Rooms (bed/bath details)\n3. Exterior (lot & amenities)\n4. Neighborhood (proximate factors)\n5. Schools (top-rated zones)\n6. Community Pulse (local vibe)\n7. Investment Research (ROI & yields)\n8. City Neighborhoods (comparative pockets)\n9. Property Economics (TAX & valuation)\n10. Context Graph (AI-driven mapping)", 
                "imageUrl": "/guide-images/overview_note_step.png" 
            },
            {
                "step": 7,
                "title": "Interactive AI Concierge",
                "action": "Use the Zyphe Concierge chatbot to inquire about specific property details, search for deep-dive insights, and learn more via real-time conversation.",
                "imageUrl": "/guide-images/chatbot_step.png"
            },
            {
                "step": 8,
                "title": "Technical Transparency Center",
                "action": "For a deep dive into our 15+ data sources, environmental scoring methodologies, and the 88 decision factors driving our intelligence, visit our technical owner's manual.",
                "link": "/training/platform-technical-manual"
            }
        ],
        "whatThisDoesNotMean": { "title": "Note", "points": ["This is an educational walkthrough."] },
        "commonMisunderstandings": [],
        "expertPerspective": { "title": "Tip", "assessment": "Simple steps lead to clear value.", "riskMitigation": [] },
        "faqs": [],
        "keyTakeaways": ["Login", "Search", "Review", "Note"]
    };

    const docId = `${topicSlug}_${slug}`;
    console.log(`Seeding guide: ${docId}...`);
    
    await db.collection('guides').doc(docId).set({
        id: docId,
        topicSlug,
        slug,
        title,
        content: guideContent,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('Successfully seeded simple buyer instructions to Firestore.');
}

seedBuyerInstructions().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
