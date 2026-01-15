import React, { useState } from 'react';

type Section = 'timings' | 'buyer_agent' | 'seller_agent';

const BestPracticesTab: React.FC = () => {
    const [activeSection, setActiveSection] = useState<Section>('timings');

    return (
        <div className="flex h-full w-full bg-[#F8FAFC]">
            {/* Sidebar Navigation */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col items-center py-6">
                <nav className="w-full px-4 space-y-2">
                    <button
                        onClick={() => setActiveSection('timings')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'timings'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'timings' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-regular fa-clock"></i>
                        </div>
                        Timings
                    </button>
                    <button
                        onClick={() => setActiveSection('buyer_agent')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'buyer_agent'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'buyer_agent' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-user-tie"></i>
                        </div>
                        Buyer Agent
                    </button>
                    <button
                        onClick={() => setActiveSection('seller_agent')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'seller_agent'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'seller_agent' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-house-chimney-user"></i>
                        </div>
                        Seller Agent
                    </button>
                    {/* Placeholder for future tabs */}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                    {activeSection === 'timings' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Real Estate Communication Protocols</h2>
                                <p className="text-lg text-slate-500 font-medium">Standard operating procedures for timely and effective client interactions.</p>
                            </div>

                            <div className="grid gap-6">
                                {/* Card 1 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-reply"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">1. Respond Promptly to Clients</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                Objective: Show respect, professionalism, and engagement.
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                Aim to reply to inquiries and follow-ups quickly—often within <span className="font-bold text-slate-700">24 to 48 hours</span>. Prompt responses signal that the client’s time matters and help maintain momentum in the sales process.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-scale-balanced"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">2. Set Realistic and Honest Timelines</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                Avoid over-promising. Don’t tell clients what they want to hear if it’s unlikely to happen (e.g., unrealistic closing dates).
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                Provide clear, honest estimates for processes like offer acceptance, inspections, financing, and closing. Managing expectations upfront reduces misunderstandings, stress, and risk of frustration later.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-eye"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">3. Maintain Transparency Throughout the Process</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                Consistent updates: Even if there’s no new major news, let clients know progress.
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                Share changes, delays, and obstacles as soon as possible. Transparency builds trust and equips clients to make informed decisions.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-list-check"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">4. Use a Structured Follow-Up Cadence</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                Have a system or schedule for regular check-ins rather than waiting for the client to reach out. This could include:
                                            </p>
                                            <ul className="list-disc list-inside text-slate-500 text-sm space-y-1 ml-2">
                                                <li>Weekly status summaries</li>
                                                <li>Mid-process checkpoints</li>
                                                <li>Post-milestone recap messages</li>
                                            </ul>
                                            <p className="text-slate-500 text-sm mt-3">
                                                This proactive cadence ensures clients stay informed and feel supported.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 5 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-shoe-prints"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">5. Clarify Next Steps and Responsibilities</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                After every interaction, outline what happens next, who is responsible, and by when.
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                When clients know exactly what to expect and what’s expected of them, they feel more secure and less anxious. Include clear reminders of upcoming deadlines.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 6 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-volume-high"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">6. Communicate Even When You Don’t Have Full Answers</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                A short, timely acknowledgement like “I received your message and am working on it—update by 4 PM tomorrow” reassures the client.
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                This prevents the silent gaps that create uncertainty and reassures the client that you’re actively managing their needs.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 7 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-sliders"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">7. Personalize Communication Based on Client Preferences</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                Ask upfront: How do you prefer to be contacted? (text, email, phone?) What frequency of updates feels right to you?
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                Tailoring timeliness to preferences improves comfort and ensures your communication rhythm aligns with client expectations.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 8 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-database"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">8. Track and Document Communications</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                Use tools like a CRM or shared communication logs to track all interactions, avoid duplicate contact, and ensure no questions are overlooked.
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                Organized timelines and records also help when working with teams or referring clients to others.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 9 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-lime-100 text-lime-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-flag-checkered"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">9. Prioritize Follow-Ups After Key Milestones</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                After showings, final offers, inspections, or financing steps, reach out promptly with updates and next-step guidance.
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                A regular follow-up rhythm around milestones keeps clients informed and reduces their stress.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 10 */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0 mt-1">
                                            <i className="fa-solid fa-heart"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-2">10. Keep a Client-First Mindset</h3>
                                            <p className="text-slate-600 leading-relaxed mb-3">
                                                Treat timeliness not as a speed competition but as a service standard that helps clients feel respected, supported, and valued.
                                            </p>
                                            <p className="text-slate-500 text-sm">
                                                Clients remember consistent attention more than a single fast reply—and are more likely to refer you to others.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="mt-8 bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
                                    <div className="flex items-center gap-4 mb-4">
                                        <span className="text-2xl">🧠</span>
                                        <h3 className="text-xl font-black text-indigo-900">Why Timeliness Matters in Real Estate</h3>
                                    </div>
                                    <p className="text-indigo-800 leading-relaxed">
                                        Real estate transactions often involve emotional and financial stakes; delays or communication gaps can damage trust. Consistent, transparent, and well-timed communication keeps deals moving smoothly, improves satisfaction, and differentiates you from competitors.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'buyer_agent' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Buyer Agent Best Practices</h2>
                                <p className="text-lg text-slate-500 font-medium">A professional, client-first approach to guiding homebuyers from first showing to closing day.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Buying a home is both a financial milestone and an emotional journey. A skilled buyer’s agent does far more than unlock doors and submit offers — they act as a strategist, educator, negotiator, and advocate, ensuring their client’s interests are protected at every stage.
                                </p>
                            </div>

                            <div className="grid gap-6">
                                {[
                                    {
                                        title: '1. Establish a Strong Foundation With the Buyer',
                                        practice: 'Every successful transaction begins with clarity. During the initial consultation, focus on understanding both practical needs (timeline, goals) and personal motivations (lifestyle, deal-breakers). Explain agency representation and fiduciary duties early to build trust.',
                                        why: 'Setting expectations early prevents confusion later and builds trust from day one.'
                                    },
                                    {
                                        title: '2. Confirm Financial Readiness',
                                        practice: 'Guide clients toward financial preparedness before actively touring homes. Explain pre-qualification vs. pre-approval, encourage lender conversations, and review estimated costs.',
                                        why: 'Financial clarity allows buyers to search confidently within their true price range and strengthens their position when making offers.'
                                    },
                                    {
                                        title: '3. Educate Buyers on Market Conditions',
                                        practice: 'Help clients understand the current market landscape including inventory levels, competition, pricing trends, and seller expectations.',
                                        why: 'When buyers understand the market landscape, they can make informed decisions without relying on emotion or assumptions.'
                                    },
                                    {
                                        title: '4. Identify Ideal Locations & Property Criteria',
                                        practice: 'Help clients evaluate neighborhood characteristics, long-term value, commute times, schools, and future development plans, not just property aesthetics.',
                                        why: 'This strategic approach prevents buyers from focusing solely on aesthetics and encourages smarter long-term decisions.'
                                    },
                                    {
                                        title: '5. Conduct a Strategic Home Search',
                                        practice: 'Curate options that align closely with buyer goals using targeted alerts and off-market opportunities. Solicit feedback after showings to refine the search.',
                                        why: 'A focused strategy saves time and helps buyers quickly recognize the right opportunity when it appears.'
                                    },
                                    {
                                        title: '6. Prepare Buyers to Make Strong Offers',
                                        practice: 'Evaluate comparable sales, true market value, offer structure, and seller motivations. Explain risks and negotiation strategies clearly.',
                                        why: 'Agents should clearly explain risks, negotiation strategies, and possible outcomes so buyers can make confident, well-reasoned decisions.'
                                    },
                                    {
                                        title: '7. Negotiate With the Buyer’s Best Interest in Mind',
                                        practice: 'Advocate for favorable terms such as inspection contingencies, repair requests, seller credits, and optimal closing dates.',
                                        why: 'Strong negotiation protects the buyer’s finances while keeping the transaction moving forward.'
                                    },
                                    {
                                        title: '8. Manage Inspections & Due Diligence',
                                        practice: 'Coordinate the process by scheduling inspections promptly, attending when possible, reviewing reports, and advising on repairs.',
                                        why: 'This phase is critical to uncovering potential issues and ensuring the buyer understands the condition of the property.'
                                    },
                                    {
                                        title: '9. Guide Buyers Through Appraisal & Financing',
                                        practice: 'Prepare buyers for appraisal outcomes, communicate with lenders, and adjust strategies if valuation issues arise. Be proactive.',
                                        why: 'Proactive involvement helps prevent unnecessary delays or deal cancellations.'
                                    },
                                    {
                                        title: '10. Review Closing Documents & Final Numbers',
                                        practice: 'Review the closing disclosure, final loan terms, and required funds with the client before they sign.',
                                        why: 'A buyer agent acts as a second set of eyes, helping clients feel confident before signing.'
                                    },
                                    {
                                        title: '11. Conduct the Final Walk-Through',
                                        practice: 'Verify repairs were completed, ensure the property is clean and vacant, and check that agreed-upon items remain.',
                                        why: 'This step protects the buyer from last-minute surprises.'
                                    },
                                    {
                                        title: '12. Support a Smooth Closing & Transition',
                                        practice: 'Coordinate with all parties on closing day. Afterwards, provide utility reminders and local service referrals.',
                                        why: 'Long after the keys are handed over, great buyer agents remain a trusted resource.'
                                    }
                                ].map((item, index) => (
                                    <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                        <div className="mb-4">
                                            <h3 className="text-lg font-bold text-slate-900 mb-3">{item.title}</h3>
                                            <div className="pl-4 border-l-2 border-indigo-200 space-y-3">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 mb-1 block">Best Practices</span>
                                                    <p className="text-slate-600 text-sm leading-relaxed">{item.practice}</p>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 mb-1 block">Why It Matters</span>
                                                    <p className="text-slate-500 text-sm">{item.why}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Checklist */}
                            <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                        <i className="fa-solid fa-list-check"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight">Buyer Representation Checklist</h3>
                                        <p className="text-indigo-200">Key Milestones</p>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    {[
                                        {
                                            category: '🔍 Preparation & Planning',
                                            items: ['Buyer consultation & needs assessment', 'Agency explanation & agreement', 'Financial readiness & lender coordination', 'Market education']
                                        },
                                        {
                                            category: '🏘 Search & Selection',
                                            items: ['Neighborhood analysis', 'Targeted property search', 'Showings & feedback review']
                                        },
                                        {
                                            category: '✍️ Offer & Negotiation',
                                            items: ['Comparative market analysis', 'Offer strategy & preparation', 'Negotiation & counteroffers']
                                        },
                                        {
                                            category: '🛠 Contract to Close',
                                            items: ['Inspection coordination', 'Repair negotiations', 'Appraisal & financing support', 'Disclosure & contingency management']
                                        },
                                        {
                                            category: '🔑 Closing & Beyond',
                                            items: ['Final walk-through', 'Closing document review', 'Closing day coordination', 'Post-closing follow-up']
                                        }
                                    ].map((section, i) => (
                                        <div key={i}>
                                            <h4 className="font-bold text-indigo-400 uppercase tracking-widest text-xs mb-3">{section.category}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                                {section.items.map((item, j) => (
                                                    <div key={j} className="flex items-center gap-3 group">
                                                        <div className="w-4 h-4 rounded-full border border-emerald-500 flex items-center justify-center flex-shrink-0">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{item}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'seller_agent' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Seller Agent Best Practices</h2>
                                <p className="text-lg text-slate-500 font-medium">Your trusted roadmap to a successful and stress-free home sale.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Selling a home is one of the most significant financial and emotional transactions many homeowners will ever undertake. As a listing agent, you are advising, managing expectations, and helping them achieve the best possible outcome.
                                </p>
                            </div>

                            <div className="grid gap-6">
                                {[
                                    {
                                        title: '1. Initial Seller Consultation & Relationship Building',
                                        content: 'Good communication begins before a home ever hits the market. At the first meeting, build rapport, ask insightful questions (motivation, timeline, goals), and set expectations to tailor your strategy to the seller’s needs.'
                                    },
                                    {
                                        title: '2. Property Research & Market Analysis',
                                        content: 'Before suggesting a price, perform a Comparative Market Analysis (CMA) evaluating recent sales, active listings, and market trends. Data-backed insights support your pricing recommendation and build confidence.'
                                    },
                                    {
                                        title: '3. Pricing Strategy That Matches Market Conditions',
                                        content: 'Overpricing leads to stagnation; underpricing leaves money on the table. Collaboratively select a strategy that reflects market conditions, competition, and the seller\'s specific goals.'
                                    },
                                    {
                                        title: '4. Prepare the Home for the Market',
                                        content: 'Guide sellers on decluttering, repairs, curb appeal, and staging. These updates improve first impressions online and in person, increasing interest and potential sale price.'
                                    },
                                    {
                                        title: '5. Professional Marketing & Listing Launch',
                                        content: 'High-quality marketing is non-negotiable. Use pro photos/video, virtual tours, engaging descriptions, MLS syndication, and social advertising to make the listing stand out.'
                                    },
                                    {
                                        title: '6. Showings & Open Houses',
                                        content: 'Coordinate showings efficiently using scheduling platforms. Advise sellers on vacating during tours so buyers feel comfortable. Collect feesback to refine strategy.'
                                    },
                                    {
                                        title: '7. Offer Review & Negotiation',
                                        content: 'Carefully review offers with your seller, comparing price, contingencies, and timelines. Explain risks and benefits so they can make informed decisions. Negotiate terms, not just price.'
                                    },
                                    {
                                        title: '8. Contract to Closing Coordination',
                                        content: 'Coordinate inspections, appraisals, and repairs. Monitor deadlines and keep all parties informed to avoid delays. Clear communication prevents stress.'
                                    },
                                    {
                                        title: '9. Final Preparations & Closing',
                                        content: 'Ensure the home is in agreed condition and repairs are done. Review closing documents with your client. Coordinate logistics for a smooth transfer.'
                                    },
                                    {
                                        title: '10. Post-Closing Follow-Up',
                                        content: 'Great service doesn\'t end at closing. Follow up on questions, offer vendor referrals, and stay in touch. Satisfied sellers are powerful referral sources.'
                                    }
                                ].map((item, index) => (
                                    <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                        <div className="mb-4">
                                            <h3 className="text-lg font-bold text-slate-900 mb-3">{item.title}</h3>
                                            <p className="text-slate-600 text-sm leading-relaxed">{item.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Checklist */}
                            <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                        <i className="fa-solid fa-list-check"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight">Ultimate Seller Agent Checklist</h3>
                                        <p className="text-indigo-200">Key Milestones</p>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    {[
                                        {
                                            category: '🎯 Before Listing',
                                            items: ['Initial seller consultation', 'Competitive market analysis (CMA)', 'Pricing strategy guidance', 'Home preparation plan', 'Professional photography/video scheduling']
                                        },
                                        {
                                            category: '📣 Marketing & Exposure',
                                            items: ['MLS listing creation', 'High-quality photos & tours', 'Targeted online/social marketing', 'Agent network outreach', 'Marketing materials']
                                        },
                                        {
                                            category: '🏡 Showings & Open Houses',
                                            items: ['Showings scheduling & feedback', 'Open house execution (optional)', 'Buyer traffic tracking']
                                        },
                                        {
                                            category: '📄 Offer through Contract',
                                            items: ['Offer review & consultation', 'Counteroffer guidance', 'Contingency coordination', 'Inspection results management', 'Appraisal oversight', 'Title & disclosure management']
                                        },
                                        {
                                            category: '📆 Closing & Post-Closing',
                                            items: ['Final walk-through coordination', 'Closing logistics', 'Document review support', 'Post-closing follow-up', 'Client care & referral cultivation']
                                        }
                                    ].map((section, i) => (
                                        <div key={i}>
                                            <h4 className="font-bold text-indigo-400 uppercase tracking-widest text-xs mb-3">{section.category}</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                                {section.items.map((item, j) => (
                                                    <div key={j} className="flex items-center gap-3 group">
                                                        <div className="w-4 h-4 rounded-full border border-emerald-500 flex items-center justify-center flex-shrink-0">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{item}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BestPracticesTab;
