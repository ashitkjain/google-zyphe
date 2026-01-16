import { ReminderRule } from '../types';

export const getDefaultReminderRules = (): Omit<ReminderRule, 'realtorId'>[] => [
    // A. Lead & Prospecting (1–8)
    {
        id: 'rule-001',
        name: 'New lead – immediate follow-up',
        trigger: 'Lead created',
        condition: 'No response within 5 minutes',
        urgency: 'high',
        category: 'lead',
        suggested_action: 'Call/text new lead immediately',
        suggested_message: 'Hi {firstName}! I just received your inquiry about {propertyAddress}. I\'d love to connect and answer any questions you have. When would be a good time to chat?',
        enabled: true
    },
    {
        id: 'rule-002',
        name: 'Unresponsive lead – 24h',
        trigger: 'Lead created',
        condition: 'No reply in 24 hours',
        urgency: 'high',
        category: 'lead',
        suggested_action: 'Send short value-based follow-up',
        suggested_message: 'Hey {firstName}, I wanted to share some recent market insights about {neighborhood}. Properties like the one you viewed are moving fast. Let me know if you\'d like to discuss further!',
        enabled: true
    },
    {
        id: 'rule-003',
        name: 'Unresponsive lead – 72h',
        trigger: 'Lead created',
        condition: 'No reply in 72 hours',
        urgency: 'medium',
        category: 'lead',
        suggested_action: 'Switch channel (call if texting, email if calling)',
        suggested_message: 'Hi {firstName}, just checking in! I know buying/selling can be overwhelming. If you have any questions about the market or next steps, I\'m here to help. No pressure!',
        enabled: true
    },
    {
        id: 'rule-004',
        name: 'Lead viewed listing',
        trigger: 'Listing viewed ≥2 times',
        condition: 'No tour booked in 48 hours',
        urgency: 'high',
        category: 'lead',
        suggested_action: 'Offer showing or similar homes',
        suggested_message: '{firstName}, I noticed you\'ve been checking out {propertyAddress}. Would you like to schedule a showing? I can also recommend similar properties in the area if you\'re interested!',
        enabled: true
    },
    {
        id: 'rule-005',
        name: 'Hot lead cooling',
        trigger: 'Lead tagged "Hot"',
        condition: 'No contact in 7 days',
        urgency: 'high',
        category: 'lead',
        suggested_action: 'Re-engage with urgency',
        suggested_message: '{firstName}, haven\'t heard from you in a bit! Just wanted to let you know the market is really active right now. Let me know if you\'re still interested in moving forward!',
        enabled: true
    },
    {
        id: 'rule-006',
        name: 'First conversation follow-up',
        trigger: 'Initial call completed',
        condition: 'No next step logged in 24 hours',
        urgency: 'high',
        category: 'lead',
        suggested_action: 'Propose a concrete next step',
        suggested_message: 'Great chatting with you today, {firstName}! Based on our conversation, I think the next step would be to {nextAction}. Does {suggestedTime} work for you?',
        enabled: true
    },
    {
        id: 'rule-007',
        name: 'Tour scheduled reminder',
        trigger: 'Tour booked',
        condition: '24 hours before tour',
        urgency: 'medium',
        category: 'lead',
        suggested_action: 'Confirm time & expectations',
        suggested_message: 'Hi {firstName}! Just confirming our showing tomorrow at {tourTime} for {propertyAddress}. Looking forward to it! Let me know if you have any questions beforehand.',
        enabled: true
    },
    {
        id: 'rule-008',
        name: 'Post-tour follow-up',
        trigger: 'Tour completed',
        condition: '2 hours after',
        urgency: 'high',
        category: 'lead',
        suggested_action: 'Ask for feedback & objections',
        suggested_message: 'Hey {firstName}, thanks for touring {propertyAddress} today! What did you think? Any questions or concerns I can address?',
        enabled: true
    },

    // B. Active Buyer Deal (9–18)
    {
        id: 'rule-009',
        name: 'Offer intent reminder',
        trigger: 'Buyer interested',
        condition: 'No offer drafted within 48 hours',
        urgency: 'high',
        category: 'buyer',
        suggested_action: 'Check readiness & urgency',
        suggested_message: '{firstName}, I know you loved {propertyAddress}. Are you thinking about making an offer? Happy to run comps and help you determine a competitive price!',
        enabled: true
    },
    {
        id: 'rule-010',
        name: 'Offer submitted – no response',
        trigger: 'Offer sent',
        condition: 'No response in 24 hours',
        urgency: 'high',
        category: 'buyer',
        suggested_action: 'Follow up with listing agent',
        suggested_message: 'Hi {listingAgent}, just following up on the offer we submitted for {propertyAddress}. Any updates from the seller? Let me know if you need anything else!',
        enabled: true
    },
    {
        id: 'rule-011',
        name: 'Multiple offer check',
        trigger: 'Offer submitted',
        condition: 'Listing marked "Hot"',
        urgency: 'high',
        category: 'buyer',
        suggested_action: 'Ask about competing offers',
        suggested_message: '{firstName}, quick heads up – this property is getting a lot of attention. I\'m checking with the listing agent to see if there are multiple offers. We may need to adjust our strategy to stay competitive.',
        enabled: true
    },
    {
        id: 'rule-012',
        name: 'Offer accepted – next steps',
        trigger: 'Offer accepted',
        condition: '2 hours after acceptance',
        urgency: 'high',
        category: 'buyer',
        suggested_action: 'Outline escrow timeline to buyer',
        suggested_message: 'Congratulations, {firstName}! Your offer was accepted! Here\'s what happens next: 1) Earnest money deposit within 48hrs, 2) Schedule inspection within 3 days, 3) Loan approval timeline. I\'ll guide you every step of the way!',
        enabled: true
    },
    {
        id: 'rule-013',
        name: 'Earnest money deposit',
        trigger: 'Offer accepted',
        condition: 'EMD not confirmed in 48 hours',
        urgency: 'high',
        category: 'buyer',
        suggested_action: 'Verify deposit status',
        suggested_message: '{firstName}, just checking in on the earnest money deposit for {propertyAddress}. Have you had a chance to transfer it? Let me know if you need the escrow company\'s info again!',
        enabled: true
    },
    {
        id: 'rule-014',
        name: 'Inspection scheduling',
        trigger: 'Escrow opened',
        condition: 'No inspection scheduled in 3 days',
        urgency: 'high',
        category: 'buyer',
        suggested_action: 'Book inspection ASAP',
        suggested_message: '{firstName}, we need to schedule the home inspection soon to stay on track. I can recommend a few trusted inspectors. Which one works for you?',
        enabled: true
    },
    {
        id: 'rule-015',
        name: 'Inspection tomorrow',
        trigger: 'Inspection scheduled',
        condition: '24 hours before',
        urgency: 'medium',
        category: 'buyer',
        suggested_action: 'Prep buyer for outcomes',
        suggested_message: 'Hi {firstName}, just a reminder that the home inspection is tomorrow at {inspectionTime}. This is your chance to learn about the property\'s condition. I\'ll be there with you!',
        enabled: true
    },
    {
        id: 'rule-016',
        name: 'Post-inspection decision',
        trigger: 'Inspection completed',
        condition: 'No action in 48 hours',
        urgency: 'high',
        category: 'buyer',
        suggested_action: 'Review repair requests or credits',
        suggested_message: '{firstName}, have you had a chance to review the inspection report? Let\'s discuss any concerns and decide if we want to request repairs or credits from the seller.',
        enabled: true
    },
    {
        id: 'rule-017',
        name: 'Loan contingency check',
        trigger: 'Escrow opened',
        condition: '7 days before contingency deadline',
        urgency: 'high',
        category: 'buyer',
        suggested_action: 'Confirm lender progress',
        suggested_message: '{firstName}, your loan contingency deadline is coming up on {deadline}. Have you heard from your lender? Let me know if you need me to follow up with them!',
        enabled: true
    },
    {
        id: 'rule-018',
        name: 'Appraisal follow-up',
        trigger: 'Appraisal ordered',
        condition: 'No update in 5 days',
        urgency: 'medium',
        category: 'buyer',
        suggested_action: 'Check appraisal status',
        suggested_message: '{firstName}, I\'m following up with the lender on the appraisal for {propertyAddress}. Will keep you posted as soon as I hear something!',
        enabled: true
    },

    // C. Listing & Seller Side (19–25)
    {
        id: 'rule-019',
        name: 'Listing prep checklist',
        trigger: 'Listing agreement signed',
        condition: 'No photos scheduled in 3 days',
        urgency: 'high',
        category: 'seller',
        suggested_action: 'Schedule photography',
        suggested_message: '{firstName}, congrats on listing with me! Next step is professional photography to showcase your home beautifully. I have a photographer ready – when works best for you?',
        enabled: true
    },
    {
        id: 'rule-020',
        name: 'Listing live – early traction',
        trigger: 'Listing live',
        condition: 'No showings in 7 days',
        urgency: 'high',
        category: 'seller',
        suggested_action: 'Review price or presentation',
        suggested_message: '{firstName}, we haven\'t had any showing requests yet. Let\'s review the pricing and photos together to make sure we\'re positioned competitively. When can we chat?',
        enabled: true
    },
    {
        id: 'rule-021',
        name: 'Low showing feedback',
        trigger: '≥5 showings',
        condition: 'Negative feedback trend',
        urgency: 'medium',
        category: 'seller',
        suggested_action: 'Discuss adjustments with seller',
        suggested_message: '{firstName}, I\'ve been tracking the feedback from showings. There are a few recurring themes we should address to increase buyer interest. Can we schedule a call?',
        enabled: true
    },
    {
        id: 'rule-022',
        name: '14-day price review',
        trigger: 'Listing live',
        condition: 'No offers in 14 days',
        urgency: 'high',
        category: 'seller',
        suggested_action: 'Propose price review',
        suggested_message: '{firstName}, we\'re at the 14-day mark with no offers yet. The market is telling us something. Let\'s review recent sales and consider a strategic price adjustment to generate more interest.',
        enabled: true
    },
    {
        id: 'rule-023',
        name: 'New comp sold',
        trigger: 'Comparable sold',
        condition: 'Listing still active',
        urgency: 'medium',
        category: 'seller',
        suggested_action: 'Re-evaluate pricing strategy',
        suggested_message: '{firstName}, a similar property just sold in your area at {compPrice}. This could impact our pricing strategy. Let\'s discuss whether we should adjust.',
        enabled: true
    },
    {
        id: 'rule-024',
        name: 'Offer received – seller response',
        trigger: 'Offer received',
        condition: 'No seller response in 12 hours',
        urgency: 'high',
        category: 'seller',
        suggested_action: 'Follow up for decision',
        suggested_message: '{firstName}, we received an offer on {propertyAddress}! Have you had a chance to review it? Let\'s discuss the terms and decide on our response.',
        enabled: true
    },
    {
        id: 'rule-025',
        name: 'Open house follow-up',
        trigger: 'Open house completed',
        condition: '24 hours later',
        urgency: 'low',
        category: 'seller',
        suggested_action: 'Send recap to seller',
        suggested_message: '{firstName}, the open house went great! We had {attendeeCount} visitors with positive feedback about {highlights}. I\'ll follow up with everyone who showed interest.',
        enabled: true
    },

    // D. Client Relationship & Long-Term Value (26–30)
    {
        id: 'rule-026',
        name: 'Quiet client',
        trigger: 'Active client',
        condition: 'No contact in 14 days',
        urgency: 'medium',
        category: 'relationship',
        suggested_action: 'Check in with value',
        suggested_message: 'Hey {firstName}, just checking in! Saw some new listings in {neighborhood} that might interest you. Let me know if you\'d like me to send them over!',
        enabled: true
    },
    {
        id: 'rule-027',
        name: 'Closing preparation',
        trigger: '7 days before closing',
        condition: '',
        urgency: 'high',
        category: 'relationship',
        suggested_action: 'Prep client for closing steps',
        suggested_message: '{firstName}, we\'re one week away from closing! Here\'s what to expect: 1) Final walkthrough, 2) Wire transfer instructions (watch for fraud!), 3) Closing day timeline. Excited for you!',
        enabled: true
    },
    {
        id: 'rule-028',
        name: 'Post-closing follow-up',
        trigger: 'Deal closed',
        condition: '3 days after',
        urgency: 'low',
        category: 'relationship',
        suggested_action: 'Thank-you & review request',
        suggested_message: 'Congratulations on your new home, {firstName}! 🎉 It was a pleasure working with you. If you have a moment, I\'d really appreciate a review of your experience. Here\'s the link: {reviewLink}',
        enabled: true
    },
    {
        id: 'rule-029',
        name: 'Home anniversary',
        trigger: 'Closing anniversary',
        condition: '1 year later',
        urgency: 'low',
        category: 'relationship',
        suggested_action: 'Send home anniversary note',
        suggested_message: 'Happy one-year home anniversary, {firstName}! 🏡 Hope you\'re loving {propertyAddress}. Let me know if you ever need recommendations for contractors, home services, or anything else!',
        enabled: true
    },
    {
        id: 'rule-030',
        name: 'Referral ask',
        trigger: 'Positive outcome logged',
        condition: '7 days later',
        urgency: 'low',
        category: 'relationship',
        suggested_action: 'Ask for referrals gently',
        suggested_message: '{firstName}, I\'m so glad everything worked out! If you know anyone else looking to buy or sell, I\'d love to help them too. Referrals from happy clients like you mean the world to me!',
        enabled: true
    }
];
