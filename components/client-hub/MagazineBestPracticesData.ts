import { PlaybookProps } from './best-practices/MagazinePlaybookLayout';

export const BEST_PRACTICES_DATA: Record<string, PlaybookProps> = {
    timings: {
        badge: 'Timing & Velocity',
        title: 'Performance Communication Protocols',
        subtitle: 'Response speed is the #1 differentiator in conversion. Master the rituals of high-velocity real estate.',
        heroImage: '/assets/playbook/timings_hero.png',
        heroTitle: 'The Golden Hour Rule',
        heroDescription: 'In modern real estate, speed to lead isn\'t just a metric—it\'s the foundation of trust. Leads contacted within 5 minutes are 21x more likely to convert. Consistency and transparency build the bridge to a closed deal.',
        strategyTitle: 'Standard Operating Procedures',
        strategyDescription: 'Consistent timeliness communicates respect and level-headedness in high-stakes environments. Follow these 10 core principles for elite communication.',
        strategies: [
            { title: 'The 5-Minute Lead Rule', description: 'Immediate response is critical. Aim for under 5 minutes for new leads, and stay within 24 hours for active clients to maintain professional momentum.', icon: 'fa-bolt' },
            { title: 'Realistic Timeline Setting', description: 'Avoid over-promising. Provide clear, honest estimates for offer acceptance, inspections, and closing to manage expectations upfront.', icon: 'fa-scale-balanced' },
            { title: 'Absolute Transparency', description: 'Even if there is no major news, consistent updates prevent silence gaps and equip clients to make informed decisions.', icon: 'fa-eye' },
            { title: 'Structured Follow-up Cadence', description: 'Establish a regular schedule for check-ins—weekly summaries and mid-process checkpoints—rather than waiting for clients to ask.', icon: 'fa-list-check' },
            { title: 'Clarify Next Steps', description: 'After every interaction, outline what happens next, who is responsible, and by when to reduce client anxiety.', icon: 'fa-shoe-prints' },
            { title: 'The Acknowledgement Loop', description: 'Communicate even without full answers. A short "Received, working on it" reassures the client you are actively managing their needs.', icon: 'fa-reply' },
            { title: 'Client Preference Alignment', description: 'Ask upfront about preferred contact methods (SMS, email, call) and update frequency to ensure your rhythm matches theirs.', icon: 'fa-sliders' },
            { title: 'Document Every Interaction', description: 'Use CRM tools to track all communications, avoiding duplicate contact and ensuring no question goes overlooked.', icon: 'fa-database' },
            { title: 'Milestone Momentum', description: 'Reach out immediately after showings, inspections, or financing steps with updates and strategic next-step guidance.', icon: 'fa-flag-checkered' },
            { title: 'The Client-First Mindset', description: 'Treat timeliness as a service standard that demonstrates value. Consistent attention builds long-term loyalty and referrals.', icon: 'fa-heart' }
        ],
        checklists: [
            {
                title: 'Daily Velocity Rituals',
                items: [
                    'Clear inbox every morning by 9 AM',
                    'Respond to active client queries within 2 hours',
                    'Check CRM "Hot Leads" every 30 minutes',
                    'Acknowledge new leads within 5 minutes',
                    'Send specific "Next Steps" recap after every call'
                ]
            }
        ],
        templatesTitle: 'Timing & Momentum Benchmarks',
        templates: [
            { tag: 'Initial Inquiry', title: 'Speed to Lead', subtitle: 'Target: 5-30 Minutes', body: 'Hi [Name], I just received your inquiry about [Property]. Are you available for a 2-minute call to discuss the latest activity on this street?' },
            { tag: 'Ongoing Query', title: 'The Acknowledgement', subtitle: 'Target: 1 Business Day', body: 'Got your message about [Topic]! I\'m gathering the specific data for you now and will have a full update by [Time] today.' },
            { tag: 'Post-Showing', title: 'The Momentum Builder', subtitle: 'Target: Immediate', body: 'Great seeing you at [Property]! Here is a 1-page summary of how this property compares to others we\'ve seen this week.' }
        ],
        footerTagline: 'Consistency beats intensity. Build your reputation on reliability and respect for time.'
    },
    buyer_agent: {
        badge: 'Strategic Guiding',
        title: 'The Elite Buyer Representation',
        subtitle: 'Moving beyond "unlocking doors." Become the strategist, educator, and advocate your clients deserve.',
        heroImage: '/assets/playbook/buyer_agency_hero.png',
        heroTitle: 'Advocacy Over Sales',
        heroDescription: 'A skilled buyer\'s agent acts as a fiduciary first. Your value lies in protecting their interests at every turn, from discovery to closing.',
        strategyTitle: 'The Success Blueprint',
        strategyDescription: 'Every closing begins with a strong foundation of education and financial readiness.',
        strategies: [
            { title: 'The Deep Discovery', description: 'Focus on motivations and lifestyle goals, not just beds and baths. Understand the "Why" behind the "What".', icon: 'fa-magnifying-glass' },
            { title: 'Financial Pre-Flight', description: 'Ensure full pre-approval and cost transparency before the first tour. Confidence comes from clarity.', icon: 'fa-dollar-sign' },
            { title: 'The Strategic Search', description: 'Curate off-market opportunities and analyze neighborhood long-term value, not just aesthetics.', icon: 'fa-map-location-dot' }
        ],
        sideImage: '/assets/playbook/connection.png',
        checklists: [
            {
                title: 'Buyer Success Checklist',
                items: [
                    'Comprehensive Buyer Consultation (60 mins)',
                    'Formal Pre-Approval from verified lender',
                    'Signed Agency Agreement & Disclosure',
                    'Detailed Needs Assessment (Neighborhoods/Schools)',
                    'Automated Listing Alerts established'
                ]
            }
        ],
        insights: [
            {
                title: 'Winning the Search',
                type: 'text',
                content: 'Differentiate between "Wants" (Wish List) and "Needs" (Non-negotiables). Focus on searching for the neighborhood first, then the house.'
            }
        ],
        templatesTitle: 'Client Education Hooks',
        templates: [
            { tag: 'Discovery', title: 'Needs Assessment', subtitle: 'Initial Consultation', body: 'Hi [Name], I\'ve put together a "Buyer Strategy Guide" tailored to the [Neighborhood] market. When can we spend 20 minutes reviewing your goals?' },
            { tag: 'Finance', title: 'Readiness Check', subtitle: 'Pre-Approval Prep', body: 'I just spoke with a lender who has a unique program for [Client Type]. It might give us 10% more leverage in our next offer. Want the details?' },
            { tag: 'Selection', title: 'The Neighborhood Deep-Dive', subtitle: 'Long-term Value', body: 'I noticed a zoning change near [Street] that could significantly impact property values there in 3 years. Let\'s discuss how this affects our search.' }
        ],
        footerTagline: 'Your clients aren\'t just buying a home; they\'re investing in a future. Guide them well.'
    },
    seller_agent: {
        badge: 'High-Stake Advising',
        title: 'The Luxury Listing Protocol',
        subtitle: 'Elevate your approach from "listing agent" to "strategic advisor." Maximize value through precision.',
        heroImage: '/assets/playbook/seller_agency_hero.png',
        heroTitle: 'Narrative-Driven Marketing',
        heroDescription: 'Every home has a story. Your job is to tell it in a way that resonates with the most qualified buyers and justifies the price.',
        strategyTitle: 'The Valuation Engine',
        strategyDescription: 'Pricing is a strategy, not a guess. Use data-backed insights to win confidence and market share.',
        strategies: [
            { title: 'Psychological Staging', description: 'Guide sellers on updates that improve first impressions and perceived value online and in-person.', icon: 'fa-couch' },
            { title: 'The CMA Deep-Dive', description: 'Perform a CMA that evaluates active competition and market velocity, not just historical sales.', icon: 'fa-chart-line' },
            { title: 'Active Negotiation', description: 'Negotiate terms, not just price. Optimize for contingencies, timelines, and seller peace of mind.', icon: 'fa-handshake' }
        ],
        sideImage: '/assets/playbook/strategy.png',
        checklists: [
            {
                title: 'Elite Seller Rituals',
                items: [
                    'Property Walkthrough & Repairs Audit',
                    'Professional Photography & Video Scripting',
                    'Cross-referencing Appraisal Data',
                    'Crafting the "Story" property description'
                ]
            }
        ],
        templatesTitle: 'Listing Hooks',
        templates: [
            { tag: 'Valuation', title: 'The Market Shift', subtitle: 'Pricing Strategy', body: 'Hi [Name], a home on [Street] just closed for [Price]. This changes the "Sold-to-List" ratio for our area. I have an updated valuation for you.' },
            { tag: 'Preparation', title: 'The ROI Edge', subtitle: 'Staging & Repair', body: 'I found that homes in [Neighborhood] with [Specific Update] are selling 12 days faster. Let\'s see if we can implement this for your launch.' },
            { tag: 'Launch', title: 'The VIP Preview', subtitle: 'Marketing Teaser', body: 'Your listing goes live in 48 hours. I\'ve already sent the "First Look" to my network of top-producing agents. The buzz is starting.' }
        ],
        footerTagline: 'Real estate is personal. Treat every listing as if it were your own home.'
    },
    communication: {
        badge: 'Multi-Channel Mastery',
        title: 'High-Performance Engagement',
        subtitle: 'Communication is the bridge between a lead and a closing. Master the art of the multi-channel follow-up.',
        heroImage: '/assets/playbook/communication_hero.png',
        heroTitle: 'The Rhythm of Trust',
        heroDescription: 'Consistency beats intensity. A structured schedule of updates prevents anxiety and builds deep client loyalty.',
        strategyTitle: 'The Framework of Clarity',
        strategyDescription: 'Mastering communication means reducing stress for your clients through proactive updates.',
        strategies: [
            { title: 'Multi-Channel Loops', description: 'Use the right tool for the job: Email for data, SMS for speed, Calls for emotion and complexity.', icon: 'fa-comments' },
            { title: 'The Friday Summary', description: 'A weekly progress report, even if there\'s no "news", reassures clients that you are on the job.', icon: 'fa-calendar-check' },
            { title: 'The Script Library', description: 'Prepare for difficult conversations—lost offers, low appraisals—before they happen.', icon: 'fa-scroll' }
        ],
        sideImage: '/assets/playbook/connection.png',
        insights: [
            {
                title: 'Preferred Communication Channels',
                type: 'table',
                content: [
                    { Channel: 'Email', Use_Case: 'Market Reports, Contracts, Detailed Updates', Priority: 'Medium' },
                    { Channel: 'SMS', Use_Case: 'Quick Confirmations, Scheduling, Immediate News', Priority: 'High' },
                    { Channel: 'Phone Call', Use_Case: 'Negotiation, Strategy, Emotional Support', Priority: 'Critical' },
                    { Channel: 'Video Message', Use_Case: 'Weekly Recaps, Personalized Touches', Priority: 'High' }
                ]
            },
            {
                title: 'The Communication Timeline',
                type: 'timeline',
                content: [
                    { label: 'Day 1', title: 'Initial Response', description: 'Fast response, setting expectations.' },
                    { label: 'Day 3', title: 'Strategy Call', description: 'Reviewing market data and narrowing search.' },
                    { label: 'Day 7', title: 'Weekly Recap', description: 'Summarizing activity and planning next steps.' }
                ]
            }
        ],
        templatesTitle: 'Engagement Scripts',
        templates: [
            { tag: 'Follow-up', title: 'The Value Drop', subtitle: 'Email Protocol', body: '"Hi [Name], I noticed a shift in [Neighborhood] trends this morning. I\'ve attached a 2-page analysis of how this impacts your search."' },
            { tag: 'Confirmation', title: 'The Quick Check', subtitle: 'SMS Protocol', body: '"Just sent you that market update! No need to reply now, but let me know when you have 5 mins to chat about page 2."' },
            { tag: 'Update', title: 'The Weekly Recap', subtitle: 'Friday Ritual', body: '"Happy Friday! Here is our weekly summary of showings, agent feedback, and our strategy for next week. Talk soon!"' }
        ],
        footerTagline: 'Effective communication is about being heard, understood, and trusted.'
    },
    listing_marketing: {
        badge: 'Luxury Presentation',
        title: 'The Modern Listing Suite',
        subtitle: 'From MLS prep to multi-media mastery. Elevate the presentation of every property to high-end standards.',
        heroImage: '/assets/playbook/marketing_hero.png',
        heroTitle: 'Narrative Excellence',
        heroDescription: 'High-quality marketing is non-negotiable. Use professional visual storytelling to make every listing stand out.',
        strategyTitle: 'The Exposure Protocol',
        strategyDescription: 'A well-prepared listing attracts qualified buyers and maximizes the eventual sale price.',
        strategies: [
            { title: 'Visual Standards', description: '15-25 staged, professional wide-angle shots. High-end video storytelling highlighting lifestyle amenities.', icon: 'fa-camera' },
            { title: 'Smart Descriptions', description: 'Avoid clichés. Use facts, lifestyle benefits, and a compelling opening hook to engage buyers.', icon: 'fa-pen-nib' },
            { title: '360° Immersion', description: 'Virtual tours and drone footage are essential for remote buyers and unique lot presentations.', icon: 'fa-video' }
        ],
        sideImage: '/assets/playbook/strategy.png',
        insights: [
            {
                title: 'Luxury Photo & Video Standards',
                type: 'table',
                content: [
                    { Asset: 'Photography', Standard: '15-25 Staged, High-Def wide angle shots', Value: 'Critical' },
                    { Asset: 'Aerial Video', Standard: 'Drone footage of property and lot layout', Value: 'High' },
                    { Asset: 'Virtual Tour', Standard: 'Matterport or 360-degree interactive tour', Value: 'High' },
                    { Asset: 'Night Shots', Standard: 'Showcase external lighting and pool areas', Value: 'Luxury' }
                ]
            },
            {
                title: 'The Listing Workflow',
                type: 'timeline',
                content: [
                    { label: 'Prep', title: 'Staging & Repairs', description: 'Removing clutter, neutral colors, curb appeal.' },
                    { label: 'Asset', title: 'Pro Production', description: 'Photo/Video session and brochure design.' },
                    { label: 'Launch', title: 'MLS & Network', description: 'Going live and internal broker previews.' }
                ]
            }
        ],
        templatesTitle: 'Marketing Milestones',
        templates: [
            { tag: 'MLS Prep', title: 'Data Integrity', subtitle: 'Accuracy Check', body: 'Hi [Name], I\'ve verified the school districts, zoning, and keyword optimization for our launch. We are 100% data-ready.' },
            { tag: 'Promotion', title: 'The Social Lift', subtitle: 'Digital Outreach', body: 'I\'ve launched the targeted [Instagram/Facebook] campaign for [Property]. We\'ve already reached 1,200 local potential buyers.' },
            { tag: 'Visuals', title: 'The VIP Preview', subtitle: 'Network Teaser', body: 'I\'ve shared the "First Look" video with my network of top producers. We have 3 private showings requested before the MLS launch.' }
        ],
        footerTagline: 'Presentation is everything. Treat every listing as a luxury experience.'
    },
    pricing_negotiation: {
        badge: 'Tactical Closing',
        title: 'The Expert Negotiation Suite',
        subtitle: 'Mastering the art of the deal. Precision pricing meets strategic advocacy for exceptional results.',
        heroImage: '/assets/playbook/negotiation_hero.png',
        heroTitle: 'Fiduciary Precision',
        heroDescription: 'Setting the right price and protecting your client\'s interests separates the good from the exceptional.',
        strategyTitle: 'The Valuation Logic',
        strategyDescription: 'Setting expectations early and using data-backed insights build confidence and results.',
        strategies: [
            { title: 'Psychology of Pricing', description: 'Use approachable numbers and market-based logic to justify recommendations to both sides.', icon: 'fa-brain' },
            { title: 'Multiple Offer Playbook', description: 'Evaluate terms, contingencies, and financing—not just price. Encourage strategic counters.', icon: 'fa-handshake' },
            { title: 'Appraisal Gap Mastery', description: 'Prepare for gaps before they happen. Have concessions and challenge strategies ready.', icon: 'fa-chart-pie' }
        ],
        sideImage: '/assets/playbook/strategy.png',
        insights: [
            {
                title: 'The Pricing Spectrum',
                type: 'text',
                content: 'Price conservatively to drive multiple offers (The Auction Effect), or price aggressively if the asset is truly unique (The Premium Model). Always justify with a 3-mile radius absorption report.'
            }
        ],
        templatesTitle: 'Tactical Scripts',
        templates: [
            { tag: 'Pricing', title: 'The Value Anchor', subtitle: 'Setting Expectations', body: 'Hi [Name], pricing correctly initially often results in a 3-5% higher net than overpricing. Here is the data explaining why.' },
            { tag: 'Negotiation', title: 'The Inspection Bridge', subtitle: 'Repair Strategy', body: 'I\'ve prioritized the safety and functional items. Let\'s frame the request around "integrity" to keep the seller engaged.' },
            { tag: 'Winning', title: 'The Strategic Counter', subtitle: 'Terms Optimization', body: 'We have 3 offers. Let\'s counter-offer on the 10-day inspection period rather than the price to ensure a faster closing.' }
        ],
        footerTagline: 'Negotiation isn\'t about winning; it\'s about achieving the best possible outcome for your client.'
    },
    lead_generation: {
        badge: 'Pipeline Engineering',
        title: 'The Growth Pipeline Blueprint',
        subtitle: 'Build a steady stream of consistent leads. Master inbound presence and outbound networking.',
        heroImage: '/assets/playbook/leadgen_hero.png',
        heroTitle: 'Digital Dominance',
        heroDescription: 'Consistency builds trust. Your online presence should be a 24/7 storefront of your expertise.',
        strategyTitle: 'The Conversion Funnel',
        strategyDescription: 'Developing multiple lead sources ensures a resilient business and consistent growth.',
        strategies: [
            { title: 'SOI Nurture', description: 'Past clients and friends are your highest-converting referral source. Systematic touchpoints required.', icon: 'fa-people-group' },
            { title: 'Value-Based Content', description: 'Provide educational guides, market reports, and lifestyle tips to position yourself as an authority.', icon: 'fa-newspaper' },
            { title: 'Strategic Partnerships', description: 'Align with lenders, contractors, and local businesses to create cross-referral networks.', icon: 'fa-link' }
        ],
        sideImage: '/assets/playbook/connection.png',
        checklists: [
            {
                title: 'Inbound Presence Rituals',
                items: [
                    'Maintain 5-star Google Review average',
                    'Bi-weekly Market Update blog or video',
                    'Active Pinterest/Instagram board for "Neighborhood Vibe"',
                    'Client success stories featured on landing pages'
                ]
            }
        ],
        templatesTitle: 'Conversion Hooks',
        templates: [
            { tag: 'Networking', title: 'The Value Drop', subtitle: 'SOI Outreach', body: 'Hi [Name], I noticed a zoning change in your area that might affect home values. Want me to send over a 1-page summary?' },
            { tag: 'Digital', title: 'The Lead Magnet', subtitle: 'Landing Page Hook', body: '"Download my 2026 First-Time Buyer Strategy Guide." This positions you as the educator before the first meeting.' },
            { tag: 'Referral', title: 'The Partner Loop', subtitle: 'Strategic Text', body: 'Hi [Partner], I have a client who needs [Service]. I recommended you. Just wanted to keep you in the loop!' }
        ],
        footerTagline: 'Your business is as strong as your next lead. Build the engine.'
    },
    systems_productivity: {
        badge: 'Zen Operations',
        title: 'The Scalable Workflow Suite',
        subtitle: 'From "doing everything" to "managing systems." Handle more volume without the burnout.',
        heroImage: '/assets/playbook/systems_hero.png',
        heroTitle: 'Operational Excellence',
        heroDescription: 'To scale, you must move beyond manual tasks. Tools, time blocking, and clear processes are your foundation.',
        strategyTitle: 'The Efficiency Framework',
        strategyDescription: 'Focus on your highest value activities: negotiating, prospecting, and relationship building.',
        strategies: [
            { title: 'CRM Mastery', description: 'If it\'s not in the CRM, it didn\'t happen. Centralize data to prevent leaks and track history.', icon: 'fa-database' },
            { title: 'Time Blocking Rituals', description: 'Protect your most profitable hours from distractions. Treat blocks as non-negotiable appointments.', icon: 'fa-calendar-day' },
            { title: 'Smart Automation', description: 'Leverage email drips and scheduling tools for logistics, but keep personal outreach human.', icon: 'fa-robot' }
        ],
        sideImage: '/assets/playbook/strategy.png',
        insights: [
            {
                title: 'The High-Value Prototype Day',
                type: 'timeline',
                content: [
                    { label: '08:00 AM', title: 'Planning & Focus', description: 'No email. Deep work only.' },
                    { label: '10:00 AM', title: 'Lead Follow-up', description: 'Active outbound calls and CRM updates.' },
                    { label: '01:00 PM', title: 'Appointments', description: 'Showings, listings, and face-to-face client time.' },
                    { label: '04:00 PM', title: 'Admin Wrap', description: 'Prep for tomorrow and delegation to TC.' }
                ]
            }
        ],
        checklists: [
            {
                title: 'Productivity Audit',
                items: [
                    'CRM task cleanup daily',
                    'Time blocks set for next 7 days',
                    'Delegate admin task (1 per day)',
                    'Weekly performance metric review'
                ]
            }
        ],
        templatesTitle: 'Zen Scripts',
        templates: [
            { tag: 'CRM Daily', title: 'The morning sync', subtitle: 'Task management', body: 'Review tasks and hot leads for 15 mins daily. Log every call immediately. Plan specifically for tomorrow every evening.' },
            { tag: 'Automation', title: 'The Nurture Loop', subtitle: 'Logistics handling', body: '"Hi [Name], here is my scheduling link for our next strategy call: [Link]. This saves us 10 emails back and forth!"' },
            { tag: 'Delegation', title: 'The TC Hand-off', subtitle: 'Scale Strategy', body: 'Delegate paperwork to a Transaction Coordinator as soon as you hit 12 deals/year. Reclaim 10 hours per transaction.' }
        ],
        footerTagline: 'Systems provide freedom. Build the structure that supports your growth.'
    },
    transaction_compliance: {
        badge: 'Precision Integrity',
        title: 'The Risk Management Suite',
        subtitle: 'Protecting your client and your license. Meticulous management from contract to closing.',
        heroImage: '/assets/playbook/compliance_hero.png',
        heroTitle: 'The Compliance Shield',
        heroDescription: 'Meticulous transaction management ensures deals close on time and protects all parties from legal risk from contract to closing.',
        strategyTitle: 'The Integrity Protocol',
        strategyDescription: 'Documentation hygiene and timeline precision are the hallmarks of a true professional.',
        strategies: [
            { title: 'Master Milestones', description: 'Create a master calendar immediately upon acceptance. Missing a deadline can kill a deal.', icon: 'fa-clock' },
            { title: 'Documentation Hygiene', description: 'Upload signed docs same-day. Never send a blank contract. Explain every signature.', icon: 'fa-file-shield' },
            { title: 'Risk Warning Rituals', description: 'Proactively warn clients about wire fraud and fair housing. Be their shield.', icon: 'fa-shield-halved' }
        ],
        sideImage: '/assets/playbook/connection.png',
        checklists: [
            {
                title: 'Compliance Action Plan',
                items: [
                    'Review contract for missing initials',
                    'Audit inspector and appraiser credentials',
                    'Send Wire Fraud warning immediately',
                    'Final walk-through verification'
                ]
            }
        ],
        templatesTitle: 'Integrity Scripts',
        templates: [
            { tag: 'Timeline', title: 'The Milestone Alert', subtitle: 'Deadline Tracking', body: '"Hi [Name], we are 24 hours from the inspection contingency expiring. I\'ve verified we have all repair credits documented."' },
            { tag: 'Risk', title: 'The Wire Warning', subtitle: 'Security Protocol', body: '"NEVER wire funds based on an email. If you receive instructions, call my office immediately to verify. Be safe."' },
            { tag: 'Compliance', title: 'The Disclosure Loop', subtitle: 'Trust Building', body: '"I\'ve reviewed the seller disclosures. I noticed [Detail]. It\'s important we discuss what this means for your offer strategy today."' }
        ],
        footerTagline: 'Your reputation is built on the deals you close correctly.'
    },
    education_positioning: {
        badge: 'Authority Building',
        title: 'The Specialized Authority Suite',
        subtitle: 'Generic advice is everywhere. Position yourself as the specialized expert your niche deserves.',
        heroImage: '/assets/playbook/education_hero.png',
        heroTitle: 'Knowledge as Leverage',
        heroDescription: 'Stop selling, start educating. High-authority positioning builds trust that leads to higher-quality referrals.',
        strategyTitle: 'The Expertise Framework',
        strategyDescription: 'Answer specific questions better than anyone else to dominate high-intent local searches.',
        strategies: [
            { title: 'Niche Deep-Dives', description: 'Create focused guides for first-time buyers, luxury clients, or investors. Be their translator.', icon: 'fa-graduation-cap' },
            { title: 'SEO Content Rituals', description: 'Target "how to" local searches. Niche content has less competition and higher conversion.', icon: 'fa-magnifying-glass' },
            { title: 'The 10x Content Rule', description: 'Aim for depth and local insight. If it isn\'t 10x better than the top result, don\'t write it.', icon: 'fa-award' }
        ],
        sideImage: '/assets/playbook/strategy.png',
        checklists: [
            {
                title: 'Authority Action Plan',
                items: [
                    'Create "First-Time Buyer Roadmap" PDF',
                    'Write 3 posts on neighborhood schools',
                    'Film "Cost of Living" video for your city',
                    'Build "Relocation Guide" landing page'
                ]
            }
        ],
        templatesTitle: 'Authority Hooks',
        templates: [
            { tag: 'First-Time', title: 'The Roadmap Offer', subtitle: 'Education Lead-Gen', body: '"I have a 3-page Roadmap to Homeownership in [City]. It simplifies the PITI and closing costs. Want a copy?"' },
            { tag: 'Investor', title: 'The Asset Performance', subtitle: 'Data-Driven Loop', body: '"Hi [Name], I\'ve analyzed the latest cap rates in [Neighborhood]. this specific street is outperforming the average by 4%."' },
            { tag: 'Luxury', title: 'The Curated Insight', subtitle: 'Lifestyle Positioning', body: '"I have a private preview of a property with unique [Amenity] coming to market. It aligns with your focus on privacy."' }
        ],
        footerTagline: 'Authority is earned through the value you consistently provide.'
    },
    branding_development: {
        badge: 'Personal Identity',
        title: 'The Elite Brand Builder',
        subtitle: 'Move beyond "closing deals" to "building a legacy." Invest in the brand that attracts better leads.',
        heroImage: '/assets/playbook/branding_hero.png',
        heroTitle: 'The Visual Trust Factor',
        heroDescription: 'Success is about more than sales—it\'s about professional growth and personal identity. Your brand is your reputation at scale.',
        strategyTitle: 'The Identity Protocol',
        strategyDescription: 'Maintaining a consistent, premium presence across all platforms builds the "know, like, and trust" factor.',
        strategies: [
            { title: 'Visual Consistency', description: 'Invest in pro headshots and maintaining a unified aesthetic across social and print media.', icon: 'fa-camera' },
            { title: 'Messaging & PR', description: 'Define your niche clearly. Publish local insights and speak at events to position yourself as an authority.', icon: 'fa-bullhorn' },
            { title: 'Networking Rituals', description: 'Log networking contacts religiously and maintain professional development certifications.', icon: 'fa-ranking-star' }
        ],
        sideImage: '/assets/playbook/connection.png',
        checklists: [
            {
                title: 'Top Performer Checklist',
                items: [
                    'Update headshots & branding colors',
                    'Attend one local network event weekly',
                    'Maintain a networking log of partners',
                    'Time-block high-value activities daily'
                ]
            }
        ],
        templatesTitle: 'Identity Scripts',
        templates: [
            { tag: 'Visual', title: 'The Brand Refresh', subtitle: 'Identity Update', body: '"I\'ve updated my 2026 Strategy Guide with new neighborhood data. It reflects my focus on [Niche] in your area. Want a look?"' },
            { tag: 'Networking', title: 'The Partner Push', subtitle: 'Relationship Loop', body: '"Hi [Partner], I attended the Chamber event yesterday. I noticed a gap in [Service]. I think our clients could benefit from a joint guide."' },
            { tag: 'Legacy', title: 'The Value Pitch', subtitle: 'Niche Positioning', body: '"I specialize exclusively in [Niche]. This means I have data on [Detail] that general agents don\'t track. Let\'s discuss your goals."' }
        ],
        footerTagline: 'Your brand is what people say about you when you\'re not in the room.'
    },
    market_analytics: {
        badge: 'Data-Driven Insights',
        title: 'The Strategic Data Suite',
        subtitle: 'Strong market knowledge command higher fees. Master local analysis, CMAs, and investment metrics.',
        heroImage: '/assets/playbook/analytics_hero.png',
        heroTitle: 'Narrative Data',
        heroDescription: 'Don\'t just list facts. Tell the story of the market through data that builds credibility and undeniable value.',
        strategyTitle: 'The Analysis Engine',
        strategyDescription: 'Top earners separate themselves through deep local knowledge and investment-grade insights.',
        strategies: [
            { title: 'The Hot Sheet Ritual', description: 'Review MLS activity daily. Be the first to know about price shifts, absorption rates, and new trends.', icon: 'fa-chart-column' },
            { title: 'CMA Visualization', description: 'Selection 3-6 true comps. Use visual charts to show reality vs. competition and justify your range.', icon: 'fa-sliders' },
            { title: 'Investment Fluency', description: 'Master Cap Rate, Cash-on-Cash, and GRM. Speak the language of wealth to attract higher-quality clients.', icon: 'fa-calculator' }
        ],
        sideImage: '/assets/playbook/strategy.png',
        insights: [
            {
                title: 'Core Investment Metrics',
                type: 'table',
                content: [
                    { Metric: 'Cap Rate', Formula: 'NOI / Purchase Price', Goal: '> 5.5%' },
                    { Metric: 'Cash-on-Cash', Formula: 'Cash Flow / Cash Invested', Goal: '> 10%' },
                    { Metric: 'GRM', Formula: 'Price / Gross Rent', Goal: '< 15' }
                ]
            }
        ],
        checklists: [
            {
                title: 'Market Authority Checklist',
                items: [
                    'Review MLS hot sheets daily',
                    'Create monthly market update video',
                    'Build standard CMA with charts',
                    'Learn to calculate Cap Rate & COC'
                ]
            }
        ],
        templatesTitle: 'Data Hooks',
        templates: [
            { tag: 'CMA', title: 'The Reality Check', subtitle: 'Pricing Strategy', body: '"Hi [Name], property [Street] just closed. Our Sold-to-List ratio has shifted. Here is a 1-page chart on what this means for you."' },
            { tag: 'Investor', title: 'The Yield Update', subtitle: 'Wealth Loop', body: '"I\'ve analyzed the latest absorption rates for [Neighborhood]. We are seeing a 12% jump in rental demand. Are you looking to add?"' },
            { tag: 'Market', title: 'The Seasonal Shift', subtitle: 'Timing Strategy', body: '"Inventory levels in [Zip Code] just hit a 12-month low. If we launch now, we have 40% less competition than last spring."' }
        ],
        footerTagline: 'Facts win arguments. Data builds wealth.'
    },
    niche_market: {
        badge: 'Specialized Dominance',
        title: 'The Niche Authority Suite',
        subtitle: 'Attract high-intent clients by specializing. From Eco-homes to STRs, focus where others ignore.',
        heroImage: '/assets/playbook/niche_hero.png',
        heroTitle: 'Sub-Market Mastery',
        heroDescription: 'Generic agents have generic results. Specialization allows you to command higher fees and build market dominance.',
        strategyTitle: 'The Specialist Protocol',
        strategyDescription: 'Position yourself as the go-to expert for underserved segments seeking specific guidance.',
        strategies: [
            { title: 'Eco-Efficiency Loops', description: 'Highlight solar, smart-tech, and tax rebates. Show long-term savings to attract the modern buyer.', icon: 'fa-leaf' },
            { title: 'Senior & Multi-Gen', description: 'Focus on accessibility, proximity to care, and family-first amenities. Be the empathetic guide.', icon: 'fa-person-cane' },
            { title: 'STR & Vacation Mastery', description: 'Project ROI and seasonal occupancy. Know the zoning and permit regulations better than anyone else.', icon: 'fa-umbrella-beach' }
        ],
        sideImage: '/assets/playbook/connection.png',
        insights: [
            {
                title: 'The Short-Term Rental Metric',
                type: 'table',
                content: [
                    { Study: 'Occupancy Rate', Average: '65-75%', Target: '85%+' },
                    { Study: 'ADR', Average: '$150-250', Target: '$350+' },
                    { Study: 'Platform Fees', Average: '15-20%', Target: '< 12%' }
                ]
            }
        ],
        checklists: [
            {
                title: 'Niche Entry Checklist',
                items: [
                    'Define your Unique Value Prop (UVP)',
                    'Join one local niche association',
                    'Develop niche-specific lead magnet',
                    'Audit local zoning for STR potential'
                ]
            }
        ],
        templatesTitle: 'Niche Hooks',
        templates: [
            { tag: 'Eco', title: 'The Green Savings', subtitle: 'Efficiency Hook', body: '"Homes with [Feature] in [City] are selling for 4% more on average. I have a checklist to see if your home qualifies."' },
            { tag: 'Senior', title: 'The Smooth Move', subtitle: 'Empathy Protocol', body: '"I have a guide for families navigating the multi-gen housing search. It covers local healthcare proximity and safety features."' },
            { tag: 'STR', title: 'The Yield Alert', subtitle: 'Investment Hook', body: '"Airbnb occupancy in [Beach Area] just hit an all-time high for October. I found an off-market duplex with STR potential. Interest?"' }
        ],
        footerTagline: 'The riches are in the niches. Own your segment.'
    },
    reactivation: {
        badge: 'Zyphe Intelligence',
        title: 'The Lead Reactivation Playbook',
        subtitle: 'Move beyond "checking in." Master the art of value-driven database reactivation in the modern market.',
        heroImage: '/assets/playbook/cover.png',
        heroTitle: 'Philosophy: The Value Injection',
        heroDescription: 'A dormant lead isn\'t dead; they\'re just overwhelmed. Reactivate by reminding them you are their most valuable resource.',
        strategyTitle: 'The 2026 Strategy Stack',
        strategyDescription: 'Traditional follow-up is dead. Use psychological triggers and timing precision to cut through the noise.',
        strategies: [
            { title: 'AI-Augmented Personalization', description: 'Use Zyphe\'s AI analysis to reference specific neighborhood changes that occurred while the lead was dormant.', icon: 'fa-brain' },
            { title: 'The Curiosity Hook', description: 'Ask open-ended questions about neighborhood activity without asking for a commitment. Focus on velocity.', icon: 'fa-bolt' },
            { title: 'The Equity Reminder', description: 'Provide unsolicited value by sharing recent record-breaking sales in their immediate area.', icon: 'fa-house-circle-check' }
        ],
        sideImage: '/assets/playbook/strategy.png',
        templatesTitle: 'Interactive Templates',
        templates: [
            { tag: 'Investment', title: 'The "Yield Surprise"', subtitle: 'STR Focus', body: 'Hi [Name], I was just looking at the 2026 STR yields for [Neighborhood] and thought of you. Some properties here are seeing a 15% jump. Want the breakdown?' },
            { tag: 'Inventory', title: 'The "Inventory Alert"', subtitle: 'Market Momentum', body: 'Hi [Name], sudden influx of off-market listings in [Zip Code] $this week. First major shift in months. Still keeping an eye there?' },
            { tag: 'Sellers', title: 'The "Equity Update"', subtitle: 'Wealth Tracking', body: 'Hey [Name], property on [Street] just closed for a record price. This impacts your home\'s valuation. Want a 1-page updated equity report?' }
        ],
        footerTagline: 'Mastering the art of the comeback. Your database is your greatest asset.',
        footerActionLabel: 'Go to Reactivation Hub'
    }
};
