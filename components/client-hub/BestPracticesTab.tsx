import React, { useState } from 'react';

type Section = 'timings' | 'buyer_agent' | 'seller_agent' | 'communication' | 'listing_marketing' | 'pricing_negotiation' | 'lead_generation' | 'systems_productivity' | 'transaction_compliance' | 'education_positioning' | 'branding_development' | 'market_analytics' | 'niche_market';

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
                    <button
                        onClick={() => setActiveSection('communication')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'communication'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'communication' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-comments"></i>
                        </div>
                        Communication
                    </button>
                    <button
                        onClick={() => setActiveSection('listing_marketing')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'listing_marketing'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'listing_marketing' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-bullhorn"></i>
                        </div>
                        Listing & Marketing
                    </button>
                    <button
                        onClick={() => setActiveSection('pricing_negotiation')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'pricing_negotiation'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'pricing_negotiation' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-hand-holding-dollar"></i>
                        </div>
                        Pricing & Negotiation
                    </button>
                    <button
                        onClick={() => setActiveSection('lead_generation')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'lead_generation'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'lead_generation' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-laptop-code"></i>
                        </div>
                        Lead Gen & Online
                    </button>
                    <button
                        onClick={() => setActiveSection('systems_productivity')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'systems_productivity'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'systems_productivity' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-rocket"></i>
                        </div>
                        Systems & Tools
                    </button>
                    <button
                        onClick={() => setActiveSection('transaction_compliance')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'transaction_compliance'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'transaction_compliance' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-file-signature"></i>
                        </div>
                        Transaction & Risk
                    </button>
                    <button
                        onClick={() => setActiveSection('education_positioning')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'education_positioning'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'education_positioning' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-graduation-cap"></i>
                        </div>
                        Education & Authority
                    </button>
                    <button
                        onClick={() => setActiveSection('branding_development')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'branding_development'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'branding_development' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-id-card-clip"></i>
                        </div>
                        Development & Brand
                    </button>
                    <button
                        onClick={() => setActiveSection('market_analytics')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'market_analytics'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'market_analytics' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-chart-pie"></i>
                        </div>
                        Market & Analytics
                    </button>
                    <button
                        onClick={() => setActiveSection('niche_market')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === 'niche_market'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeSection === 'niche_market' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            <i className="fa-solid fa-bullseye"></i>
                        </div>
                        Niche Positioning
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

                    {activeSection === 'communication' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Realtor Communication Best Practices</h2>
                                <p className="text-lg text-slate-500 font-medium">Follow-Up, Timelines, and Client Engagement Strategies.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Effective communication is the backbone of any successful real estate career. Agents who master communication not only reduce stress and confusion for their clients but also build trust, referrals, and repeat business.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. Response Time Benchmarks */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Response Time Benchmarks: Why Speed Matters</h3>
                                    </div>
                                    <p className="text-slate-600 mb-6">According to industry research, leads contacted within 5 minutes are 21x more likely to convert. Speed builds trust.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { label: 'Initial Inquiry', time: '15-30 Minutes', desc: 'Critical for conversion.' },
                                            { label: 'Ongoing Questions', time: '1 Business Day', desc: 'Acknowledge receipt if answer isn’t ready.' },
                                            { label: 'After Showings/Offers', time: '24 Hours', desc: 'Summarize feedback and next steps.' }
                                        ].map((item, i) => (
                                            <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{item.label}</div>
                                                <div className="text-lg font-black text-indigo-600 mb-1">{item.time}</div>
                                                <div className="text-sm text-slate-500">{item.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg flex items-start gap-2">
                                        <i className="fa-regular fa-lightbulb mt-1"></i>
                                        <span><strong>Tip:</strong> Even a short acknowledgment like "I received your question and will get back to you by 4 PM" keeps clients reassured.</span>
                                    </div>
                                </div>

                                {/* 2. Preferred Channels */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Preferred Communication Channels</h3>
                                    </div>
                                    <div className="overflow-hidden rounded-xl border border-slate-200">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                                <tr>
                                                    <th className="px-6 py-3">Channel</th>
                                                    <th className="px-6 py-3">Best Use Case</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 bg-white">
                                                <tr>
                                                    <td className="px-6 py-4 font-medium text-slate-900"><i className="fa-solid fa-phone mr-2 text-slate-400"></i> Phone Call</td>
                                                    <td className="px-6 py-4 text-slate-600">Urgent updates, complex questions, sensitive negotiations</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-6 py-4 font-medium text-slate-900"><i className="fa-solid fa-comment mr-2 text-slate-400"></i> Text / SMS</td>
                                                    <td className="px-6 py-4 text-slate-600">Quick confirmations, showing reminders, short updates</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-6 py-4 font-medium text-slate-900"><i className="fa-solid fa-envelope mr-2 text-slate-400"></i> Email</td>
                                                    <td className="px-6 py-4 text-slate-600">Formal communications, contracts, detailed explanations</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* 3. Weekly Update Framework */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Weekly Update Framework</h3>
                                    </div>
                                    <p className="text-slate-600 mb-6">A structured schedule prevents unnecessary anxiety. Tell clients: "You’ll receive a weekly update every Friday."</p>
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="flex-1 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                            <div className="font-bold text-indigo-900 mb-2">Monday</div>
                                            <div className="text-sm text-indigo-700">Market recap & new listing alerts</div>
                                        </div>
                                        <div className="flex-1 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                            <div className="font-bold text-indigo-900 mb-2">Wednesday</div>
                                            <div className="text-sm text-indigo-700">Follow-up on showings or inspections</div>
                                        </div>
                                        <div className="flex-1 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                            <div className="font-bold text-indigo-900 mb-2">Friday</div>
                                            <div className="text-sm text-indigo-700">Summary of feedback & next steps</div>
                                        </div>
                                    </div>
                                </div>

                                {/* 4. Scripts for Difficult Conversations */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">4</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Scripts for Difficult Conversations</h3>
                                    </div>
                                    <div className="space-y-4">
                                        {[
                                            {
                                                scenario: 'Multiple Offers Lost',
                                                script: '“The home received several strong offers, which is common in this market. Let’s review what we can adjust to improve your next offer and keep you competitive.”'
                                            },
                                            {
                                                scenario: 'Appraisal Coming in Low',
                                                script: '“The appraisal is below the purchase price. Here are our options: renegotiate with the seller, request a second appraisal, or review your financing plan.”'
                                            },
                                            {
                                                scenario: 'Delayed Closing / Issues',
                                                script: '“There’s a slight delay with the report. I’ve confirmed the new timeline and will keep you updated immediately as soon as we receive news.”'
                                            }
                                        ].map((item, i) => (
                                            <div key={i} className="border-l-4 border-rose-300 pl-4 py-1">
                                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{item.scenario}</div>
                                                <div className="text-slate-700 italic font-medium">"{item.script}"</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 5. Timeline */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">5</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Communication Timeline</h3>
                                    </div>
                                    <div className="grid gap-2">
                                        {[
                                            { stage: 'Lead Inquiry', action: 'Response within 15-30 mins' },
                                            { stage: 'Pre-Approval', action: 'Detailed email + phone call (24h)' },
                                            { stage: 'Property Showings', action: 'Immediate feedback after viewing' },
                                            { stage: 'Offer Submission', action: 'Phone call to review terms' },
                                            { stage: 'Inspection Phase', action: '24-hour updates on items' },
                                            { stage: 'Closing Week', action: 'Daily check-ins' }
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                <span className="font-medium text-slate-900">{item.stage}</span>
                                                <span className="text-sm font-bold text-indigo-600">{item.action}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 6. Bonus Tips */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[
                                        { title: 'Consistency Beats Speed', text: 'Regular updates are better than erratic fast ones.' },
                                        { title: 'Document Everything', text: 'Track all calls and texts in your CRM.' },
                                        { title: 'Use Templates Wisely', text: 'Standardize updates but personalize the details.' },
                                        { title: 'Proactive > Reactive', text: 'Update even if there is no news.' }
                                    ].map((item, i) => (
                                        <div key={i} className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-xl border border-slate-200">
                                            <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                                            <p className="text-sm text-slate-500">{item.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Checklist */}
                            <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                        <i className="fa-solid fa-check-double"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight">Next Steps for Realtors</h3>
                                        <p className="text-indigo-200">Actionable Takeaways</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {[
                                        'Set clear response time benchmarks for yourself',
                                        'Ask clients their preferred communication channel at the first meeting',
                                        'Implement a weekly update framework and stick to it',
                                        'Prepare scripts for difficult scenarios in advance',
                                        'Track all communications in your CRM for accountability'
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                                <i className="fa-solid fa-check text-[10px] text-white"></i>
                                            </div>
                                            <span className="text-lg font-medium text-slate-200">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'listing_marketing' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Listing & Marketing Best Practices</h2>
                                <p className="text-lg text-slate-500 font-medium">From MLS Prep to Closing: Maximizing Exposure and Impact.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Selling a home successfully requires more than putting a sign in the yard. A well-prepared listing, high-quality marketing, and strategic presentation can maximize exposure, attract qualified buyers, and increase sale price.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. Preparing for MLS */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Preparing a Listing for MLS</h3>
                                    </div>
                                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                                        <h4 className="font-bold text-slate-900 mb-4">Checklist for MLS Preparation</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                'Complete all required fields accurately',
                                                'Include accurate property descriptions',
                                                'Verify school districts & zoning',
                                                'Ensure photos are high-quality & current',
                                                'Use keywords naturally in title/description'
                                            ].map((item, i) => (
                                                <div key={i} className="flex items-start gap-3">
                                                    <i className="fa-regular fa-square-check mt-1 text-emerald-500"></i>
                                                    <span className="text-slate-600 text-sm">{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Listing Checklist */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Real Estate Listing Checklist</h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {[
                                            { icon: 'fa-table-list', title: 'Property Details', text: 'All facts accurate & verifiable.' },
                                            { icon: 'fa-camera', title: 'High-Quality Photos', text: '15-25 staged professional images.' },
                                            { icon: 'fa-video', title: 'Virtual Tours', text: '360° walkthroughs for remote buyers.' },
                                            { icon: 'fa-pen-nib', title: 'Compelling Description', text: 'Storytelling + facts + lifestyle.' },
                                            { icon: 'fa-tag', title: 'Accurate Pricing', text: 'Justify with comps/trends.' },
                                            { icon: 'fa-door-open', title: 'Showing Notes', text: 'Instructions for agents.' },
                                            { icon: 'fa-link', title: 'Lead Capture', text: 'Contact forms or CTA links.' },
                                        ].map((item, i) => (
                                            <div key={i} className="p-4 border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                                                <i className={`fa-solid ${item.icon} text-indigo-500 text-xl mb-2`}></i>
                                                <div className="font-bold text-slate-900 mb-1">{item.title}</div>
                                                <div className="text-xs text-slate-500">{item.text}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. Photo & Video Standards */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Photo & Video Standards</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3 border-b pb-2">Photo Best Practices</h4>
                                            <ul className="space-y-3">
                                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-rose-500">Do:</span> Use professional wide-angle lenses.</li>
                                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-rose-500">Do:</span> Stage rooms to maximize space.</li>
                                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-rose-500">Do:</span> Shoot with natural light.</li>
                                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-rose-500">Do:</span> Capture exterior & neighborhood views.</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3 border-b pb-2">Video & Virtual</h4>
                                            <ul className="space-y-3">
                                                <li className="flex gap-3 text-sm text-slate-600"><i className="fa-solid fa-check text-rose-500 mt-1"></i> Short walkthroughs (~1-2 mins).</li>
                                                <li className="flex gap-3 text-sm text-slate-600"><i className="fa-solid fa-check text-rose-500 mt-1"></i> Drone footage for unique lots.</li>
                                                <li className="flex gap-3 text-sm text-slate-600"><i className="fa-solid fa-check text-rose-500 mt-1"></i> Virtual tours for remote exploration.</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="mt-6 text-sm text-slate-500 italic bg-rose-50 p-3 rounded-lg border border-rose-100">
                                        Tip: Avoid blurry, cluttered, or dark images — they reduce trust immediately.
                                    </div>
                                </div>

                                {/* 4. Writing Descriptions */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">4</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Writing Effective Descriptions</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="p-4 bg-slate-50 rounded-xl">
                                                <h5 className="font-black text-xs uppercase tracking-wider text-slate-500 mb-2">Structure</h5>
                                                <div className="space-y-2">
                                                    <div><span className="font-bold text-slate-900 text-sm">Opening Hook:</span> <span className="text-slate-600 text-sm">Start with the strongest feature.</span></div>
                                                    <div><span className="font-bold text-slate-900 text-sm">Core Details:</span> <span className="text-slate-600 text-sm">Sq ft, layout, upgrades.</span></div>
                                                    <div><span className="font-bold text-slate-900 text-sm">Lifestyle:</span> <span className="text-slate-600 text-sm">Schools, commute, community.</span></div>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-xl">
                                                <h5 className="font-black text-xs uppercase tracking-wider text-slate-500 mb-2">Avoid</h5>
                                                <p className="text-slate-600 text-sm">Overused phrases like “charming” or “needs TLC” unless paired with specific details.</p>
                                            </div>
                                        </div>
                                        <div className="bg-amber-50 p-5 rounded-xl border border-amber-100 relative">
                                            <div className="absolute -top-3 -right-3 bg-white text-amber-600 px-3 py-1 rounded-full shadow-sm text-xs font-bold border border-amber-200">Example</div>
                                            <p className="font-serif italic text-amber-900 text-lg leading-relaxed">
                                                "Wake up to panoramic lake views in this 3-bedroom, 2-bath home..."
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 5. Optimization & Mistakes */}
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><span className="font-bold">5</span></div>
                                            <h3 className="font-bold text-slate-900">MLS Optimization</h3>
                                        </div>
                                        <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                            <li>Fill all mandatory & optional fields.</li>
                                            <li>Add high-quality multimedia (ranks higher).</li>
                                            <li>Use targeted keywords in title/description.</li>
                                            <li>Tag accurate categories (style, school).</li>
                                            <li>Update regularly (price/status changes).</li>
                                        </ul>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center"><span className="font-bold">6</span></div>
                                            <h3 className="font-bold text-slate-900">Common Mistakes</h3>
                                        </div>
                                        <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                            <li>Poor Photography (dark/blurry).</li>
                                            <li>Inaccurate/Incomplete Data.</li>
                                            <li>Overpriced Listings (stagnation).</li>
                                            <li>Generic Descriptions (clichés).</li>
                                            <li>Ignoring Online Presentation.</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Bonus Marketing Tips */}
                                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-2xl text-white shadow-lg">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <i className="fa-solid fa-star"></i> Bonus Marketing Tips
                                    </h3>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
                                            <div className="font-bold mb-1">Social Campaigns</div>
                                            <div className="text-sm opacity-90">Target local buyers with paid/organic posts.</div>
                                        </div>
                                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
                                            <div className="font-bold mb-1">Email Newsletters</div>
                                            <div className="text-sm opacity-90">Highlight new listings to your network.</div>
                                        </div>
                                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
                                            <div className="font-bold mb-1">Digital Flyers</div>
                                            <div className="text-sm opacity-90">Offer downloadable brochures for serious buyers.</div>
                                        </div>
                                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
                                            <div className="font-bold mb-1">Virtual Open House</div>
                                            <div className="text-sm opacity-90">Host online events for wider reach.</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SEO Checklist */}
                            <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-xl">
                                        <i className="fa-solid fa-magnifying-glass"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black tracking-tight">Quick SEO Checklist</h3>
                                        <p className="text-emerald-200">For Maximum Visibility</p>
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    {[
                                        'Fill all MLS fields accurately',
                                        'Include 15–25 high-quality photos + video',
                                        'Use natural keywords in title & description',
                                        'Highlight unique features & lifestyle benefits',
                                        'Avoid clichés and generic phrasing',
                                        'Update listing as necessary',
                                        'Share listing across all channels'
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center flex-shrink-0">
                                                <i className="fa-solid fa-check text-[10px] text-emerald-400"></i>
                                            </div>
                                            <span className="text-sm font-medium text-slate-300">{item}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'pricing_negotiation' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Pricing, Negotiation & Market Expertise</h2>
                                <p className="text-lg text-slate-500 font-medium">Advanced Best Practices for Exceptional Outcomes.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Mastering pricing and negotiation separates good agents from exceptional ones. Sellers rely on your expertise to set the right price, while strong negotiation skills protect your client’s interests and ensure a smooth transaction.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. Pricing Strategy */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Pricing Strategy Best Practices</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">How to Price to Sell</h4>
                                                <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                                    <li><span className="font-bold">CMA:</span> Compare sold, active, and pending.</li>
                                                    <li><span className="font-bold">Conditions:</span> Adjust for buyer/seller markets.</li>
                                                    <li><span className="font-bold">Psychology:</span> Use approachable numbers (e.g., $499,900).</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Market vs. Aspirational</h4>
                                                <div className="bg-slate-50 p-4 rounded-xl text-sm">
                                                    <div className="mb-2"><span className="font-bold text-emerald-600">Market-Based:</span> Reflects current value. Safest for quick sales.</div>
                                                    <div><span className="font-bold text-amber-600">Aspirational:</span> Higher price to negotiate down. Risky; can stall listing.</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Reduction Strategies</h4>
                                                <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                                    <li>Monitor first 2-3 weeks closely.</li>
                                                    <li>Use incremental drops if showings are low.</li>
                                                    <li>Use data to justify adjustments to sellers.</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Explaining to Sellers</h4>
                                                <p className="text-sm text-slate-600">"Pricing correctly initially often results in a faster sale at a higher net value than overpricing. Buyers move on market value."</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Negotiation Tactics */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Negotiation Best Practices</h3>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="border border-slate-100 p-4 rounded-xl hover:shadow-md transition-shadow">
                                            <h4 className="font-bold text-indigo-900 mb-2">Multiple Offers</h4>
                                            <p className="text-sm text-slate-600">Evaluate on price AND terms (contingencies, financing). Encourage strategic counters, not just grabbing the highest number.</p>
                                        </div>
                                        <div className="border border-slate-100 p-4 rounded-xl hover:shadow-md transition-shadow">
                                            <h4 className="font-bold text-indigo-900 mb-2">Inspection Issues</h4>
                                            <p className="text-sm text-slate-600">Prioritize safety/function over cosmetics. Frame requests professionally: "For safety and functionality..."</p>
                                        </div>
                                        <div className="border border-slate-100 p-4 rounded-xl hover:shadow-md transition-shadow">
                                            <h4 className="font-bold text-indigo-900 mb-2">Appraisal Gaps</h4>
                                            <p className="text-sm text-slate-600">Prepare options: seller concession, challenge appraisal with comps, or buyer covers gap.</p>
                                        </div>
                                        <div className="border border-slate-100 p-4 rounded-xl hover:shadow-md transition-shadow">
                                            <h4 className="font-bold text-indigo-900 mb-2">Emotion Management</h4>
                                            <p className="text-sm text-slate-600">Stay calm and fact-focused. Help clients separate feelings from financial decisions.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Market Expertise */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Market Expertise: Position as an Advisor</h3>
                                    </div>
                                    <div className="grid md:grid-cols-4 gap-4">
                                        <div className="bg-emerald-50 p-4 rounded-xl text-center">
                                            <div className="font-black text-2xl text-emerald-600 mb-1"><i className="fa-solid fa-chart-line"></i></div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Track Trends</div>
                                        </div>
                                        <div className="bg-emerald-50 p-4 rounded-xl text-center">
                                            <div className="font-black text-2xl text-emerald-600 mb-1"><i className="fa-regular fa-calendar-check"></i></div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Seasonality</div>
                                        </div>
                                        <div className="bg-emerald-50 p-4 rounded-xl text-center">
                                            <div className="font-black text-2xl text-emerald-600 mb-1"><i className="fa-solid fa-graduation-cap"></i></div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Educate</div>
                                        </div>
                                        <div className="bg-emerald-50 p-4 rounded-xl text-center">
                                            <div className="font-black text-2xl text-emerald-600 mb-1"><i className="fa-solid fa-database"></i></div>
                                            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Data-Driven</div>
                                        </div>
                                    </div>
                                    <p className="text-center text-slate-500 mt-6 max-w-2xl mx-auto">
                                        Buyers and sellers value advice backed by facts, not opinion. Provide data-driven insights on economic indicators and demand.
                                    </p>
                                </div>

                                {/* Summary & Actions */}
                                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                            <i className="fa-solid fa-clipboard-list"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight">Summary of Best Practices</h3>
                                            <p className="text-indigo-200">The Blueprint for Success</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-8">
                                        <div>
                                            <h4 className="font-bold text-indigo-400 uppercase tracking-widest text-xs mb-4">Pricing</h4>
                                            <ul className="space-y-3">
                                                <li className="flex gap-3 text-sm text-slate-300"><span className="text-emerald-500">✓</span> Use CMA & data.</li>
                                                <li className="flex gap-3 text-sm text-slate-300"><span className="text-emerald-500">✓</span> Leverage psychology.</li>
                                                <li className="flex gap-3 text-sm text-slate-300"><span className="text-emerald-500">✓</span> Monitor & adjust.</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-indigo-400 uppercase tracking-widest text-xs mb-4">Negotiation</h4>
                                            <ul className="space-y-3">
                                                <li className="flex gap-3 text-sm text-slate-300"><span className="text-emerald-500">✓</span> Evaluate terms strategically.</li>
                                                <li className="flex gap-3 text-sm text-slate-300"><span className="text-emerald-500">✓</span> Prioritize safety in repairs.</li>
                                                <li className="flex gap-3 text-sm text-slate-300"><span className="text-emerald-500">✓</span> Manage emotions with facts.</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-indigo-400 uppercase tracking-widest text-xs mb-4">Expertise</h4>
                                            <ul className="space-y-3">
                                                <li className="flex gap-3 text-sm text-slate-300"><span className="text-emerald-500">✓</span> Track local trends.</li>
                                                <li className="flex gap-3 text-sm text-slate-300"><span className="text-emerald-500">✓</span> Advise with data.</li>
                                                <li className="flex gap-3 text-sm text-slate-300"><span className="text-emerald-500">✓</span> Be a trusted advisor.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'lead_generation' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Lead Generation & Online Presence</h2>
                                <p className="text-lg text-slate-500 font-medium">SEO, Social Media, and Digital Optimization.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    In today’s digital-first world, a realtor’s online presence can make or break their business. Optimizing your website, local listings, and social media platforms generates more leads, nurtures relationships, and converts inquiries into clients.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. SEO Best Practices */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Realtor SEO Best Practices</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Google Business Profile (GBP)</h4>
                                                <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                                    <li>Claim & verify your profile.</li>
                                                    <li>Ensure consistent Name, Address, Phone (NAP).</li>
                                                    <li>Add high-quality photos.</li>
                                                    <li>Get & respond to reviews professionally.</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Local Keyword Strategy</h4>
                                                <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                                    <li>Use "Realtor in [City]" in titles.</li>
                                                    <li>Target neighborhood-specific keywords.</li>
                                                    <li>Mention local schools & landmarks.</li>
                                                </ul>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Blog vs. Landing Pages</h4>
                                                <div className="bg-slate-50 p-4 rounded-xl text-sm space-y-2">
                                                    <div><span className="font-bold text-indigo-600">Blogs:</span> Educate & drive organic traffic (e.g., "First-time Buyer Tips").</div>
                                                    <div><span className="font-bold text-emerald-600">Landing Pages:</span> Capture leads for specific searches (e.g., "Condos in Downtown").</div>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Common Mistakes</h4>
                                                <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                                    <li>Ignoring mobile optimization.</li>
                                                    <li>Keyword stuffing.</li>
                                                    <li>Using stale content or stock photos.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Social Media Strategies */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Social Media Best Practices</h3>
                                    </div>

                                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                        {[
                                            { name: 'Instagram', icon: 'fa-instagram', desc: 'Visual storytelling, Stories, Reels, Local hashtags.' },
                                            { name: 'Facebook', icon: 'fa-facebook', desc: 'Listings, Events, Ads targeted by location/behavior.' },
                                            { name: 'LinkedIn', icon: 'fa-linkedin', desc: 'Thought leadership, Market insights, Referrals.' },
                                            { name: 'YouTube', icon: 'fa-youtube', desc: 'Home tours, Neighborhood guides, Education.' }
                                        ].map((platform, i) => (
                                            <div key={i} className="p-4 border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                                                <i className={`fa-brands ${platform.icon} text-2xl mb-2 text-slate-800`}></i>
                                                <div className="font-bold text-slate-900 mb-1">{platform.name}</div>
                                                <div className="text-xs text-slate-500">{platform.desc}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3">Posting Frequency</h4>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-600">IG & FB</span>
                                                    <span className="font-bold text-indigo-600">3-5x / week</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-600">LinkedIn</span>
                                                    <span className="font-bold text-indigo-600">1-2x / week</span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-slate-600">YouTube</span>
                                                    <span className="font-bold text-indigo-600">1-2x / month</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3">Content Ideas</h4>
                                            <ul className="space-y-2 text-sm text-slate-600">
                                                <li className="flex gap-2"><span className="font-bold text-slate-800">First-Time:</span> Guides, financing, tips.</li>
                                                <li className="flex gap-2"><span className="font-bold text-slate-800">Luxury:</span> High-end tours, lifestyle.</li>
                                                <li className="flex gap-2"><span className="font-bold text-slate-800">Investors:</span> ROI, rental insights.</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="mt-6 bg-slate-50 p-4 rounded-xl text-center">
                                        <p className="text-sm text-slate-600"><span className="font-bold text-indigo-600">Focus on Conversions:</span> Leads, calls, and inquiries matter more than vanity metrics like likes.</p>
                                    </div>
                                </div>

                                {/* 3. Advanced Tips */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Advanced Lead Gen Tips</h3>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-6">
                                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                            <div className="font-black text-emerald-700 mb-1">Retargeting Ads</div>
                                            <p className="text-xs text-emerald-800">Reach users who visited your site but didn't convert.</p>
                                        </div>
                                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                            <div className="font-black text-emerald-700 mb-1">Lead Magnets</div>
                                            <p className="text-xs text-emerald-800">Offer guides or checklists in exchange for emails.</p>
                                        </div>
                                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                            <div className="font-black text-emerald-700 mb-1">Collaborate</div>
                                            <p className="text-xs text-emerald-800">Partner with local businesses for referral networks.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Checklist */}
                                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                            <i className="fa-solid fa-check-double"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight">SEO & Social Checklist</h3>
                                            <p className="text-indigo-200">Optimize & Convert</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {[
                                            'Optimize Google Business Profile',
                                            'Use location keyword strategy',
                                            'Publish monthly neighborhood blogs',
                                            'Maintain targeted landing pages',
                                            'Post consistently on social media',
                                            'Focus on lead gen, not vanity metrics'
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                                </div>
                                                <span className="text-lg font-medium text-slate-200">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'systems_productivity' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Systems, Tools & Productivity</h2>
                                <p className="text-lg text-slate-500 font-medium">CRM, Follow-Up Routines, and Operational Excellence.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Success in real estate isn’t just about making deals — it’s about efficient systems. Realtors who implement the right CRM, follow-up routines, and productivity strategies consistently outperform peers and scale sustainably.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. CRM Best Practices */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">CRM Best Practices</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                                            <h4 className="font-bold text-slate-900 mb-4">Core Principles</h4>
                                            <ul className="space-y-3 text-sm text-slate-600">
                                                <li className="flex gap-3"><i className="fa-solid fa-server text-indigo-500 mt-1"></i> <div><span className="font-bold text-slate-900">Centralize Data:</span> Contact details, preferences, history.</div></li>
                                                <li className="flex gap-3"><i className="fa-solid fa-layer-group text-indigo-500 mt-1"></i> <div><span className="font-bold text-slate-900">Segment Database:</span> Buyers, Sellers, Past Clients, Hot/Cold.</div></li>
                                                <li className="flex gap-3"><i className="fa-solid fa-bell text-indigo-500 mt-1"></i> <div><span className="font-bold text-slate-900">Automate:</span> Showings, deadlines, anniversaries.</div></li>
                                                <li className="flex gap-3"><i className="fa-solid fa-plug text-indigo-500 mt-1"></i> <div><span className="font-bold text-slate-900">Integrate:</span> Sync email, calendar, marketing tools.</div></li>
                                            </ul>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                                <h5 className="font-bold text-slate-900 mb-2 text-sm"><i className="fa-solid fa-ranking-star mr-2 text-amber-500"></i> Lead Scoring</h5>
                                                <div className="text-xs space-y-2 text-slate-600">
                                                    <div><span className="font-bold text-rose-500">Hot (30-60 days):</span> Prioritize immediately.</div>
                                                    <div><span className="font-bold text-amber-500">Warm:</span> Interested, usually nurturing.</div>
                                                    <div><span className="font-bold text-blue-500">Cold:</span> Long-term nurture campaigns.</div>
                                                </div>
                                            </div>
                                            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                                <h5 className="font-bold text-slate-900 mb-2 text-sm"><i className="fa-solid fa-filter mr-2 text-emerald-500"></i> Pipeline Stages</h5>
                                                <p className="text-xs text-slate-500">Capture → Qualification → Active → Under Contract → Closed & Nurture.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Follow-Up Systems */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Follow-Up: Automation vs. Personalization</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><i className="fa-solid fa-robot text-slate-400"></i> Automation</h4>
                                            <p className="text-sm text-slate-500 mb-4">Great for efficiency and consistency.</p>
                                            <ul className="bg-slate-50 p-4 rounded-xl space-y-2 text-sm text-slate-600 list-disc list-inside border border-slate-100">
                                                <li>Drip email campaigns.</li>
                                                <li>Scheduled follow-ups.</li>
                                                <li>Birthday/Anniversary wishes.</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2"><i className="fa-solid fa-hand-holding-heart text-rose-500"></i> Personalization</h4>
                                            <p className="text-sm text-slate-500 mb-4">Great for trust and relationship building.</p>
                                            <ul className="bg-rose-50 p-4 rounded-xl space-y-2 text-sm text-slate-600 list-disc list-inside border border-rose-100">
                                                <li>Handwritten notes.</li>
                                                <li>Personalized video messages.</li>
                                                <li>Calls for milestones.</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <div className="mt-6 text-center text-sm font-medium text-indigo-600 bg-indigo-50 py-3 rounded-lg border border-indigo-100">
                                        Best Practice: Combine automation for efficiency with personal touches for impact.
                                    </div>
                                </div>

                                {/* 3. Productivity & Tools */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Productivity & Task Management</h3>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-6">
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all group">
                                            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-lg mb-3 group-hover:scale-110 transition-transform"><i className="fa-solid fa-list-check"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Prioritize Tasks</h4>
                                            <p className="text-xs text-slate-500 leading-relaxed">
                                                1. <span className="font-bold text-slate-700">High-Value:</span> Lead follow-up, meetings.<br />
                                                2. <span className="font-bold text-slate-700">Time-Sensitive:</span> Deadlines.<br />
                                                3. <span className="font-bold text-slate-700">Routine:</span> Admin, filing.
                                            </p>
                                        </div>
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all group">
                                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-lg mb-3 group-hover:scale-110 transition-transform"><i className="fa-solid fa-toolbox"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Essential Tools</h4>
                                            <p className="text-xs text-slate-500 leading-relaxed">
                                                • Transaction Management Software<br />
                                                • Email Marketing Platforms<br />
                                                • Calendar & Task Apps (Asana/Trello)<br />
                                                • Analytics Dashboards
                                            </p>
                                        </div>
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all group">
                                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center text-lg mb-3 group-hover:scale-110 transition-transform"><i className="fa-solid fa-chart-line"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Outcomes</h4>
                                            <p className="text-xs text-slate-500 leading-relaxed">
                                                • Increased conversion rates<br />
                                                • Fewer missed opportunities<br />
                                                • Scalable business growth<br />
                                                • Better work-life balance
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* System Checklist */}
                                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                            <i className="fa-solid fa-gears"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight">System Audit Checklist</h3>
                                            <p className="text-indigo-200">Scale Your Business</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {[
                                            'Centralize all client data in a CRM',
                                            'Segment leads (Hot, Warm, Cold)',
                                            'Automate routine follow-ups & reminders',
                                            'Schedule daily high-value task blocks',
                                            'Integrate email, calendar, and marketing tools',
                                            'Review pipeline stages weekly'
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                                </div>
                                                <span className="text-lg font-medium text-slate-200">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'transaction_compliance' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Transaction Management & Risk Reduction</h2>
                                <p className="text-lg text-slate-500 font-medium">Contract-to-Close Workflows and Compliance Excellence.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Real estate transactions are high-stakes and deadline-driven. By implementing structured workflows, diligent communication, and compliance-focused practices, you reduce risk, protect clients, and ensure smooth closings.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. Contract-to-Close */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Contract-to-Close Best Practices</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Deadline Tracking</h4>
                                                <p className="text-sm text-slate-600 mb-3">Create a master timeline for every transaction. Use reminders for:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Deposit', 'Inspection', 'Appraisal', 'Financing', 'Title', 'Closing'].map(tag => (
                                                        <span key={tag} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold border border-slate-200">{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Documentation Workflows</h4>
                                                <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                                    <li>Centralize all docs in a secure system.</li>
                                                    <li>Version control for contracts/addendums.</li>
                                                    <li>Ensure all parties have access.</li>
                                                    <li>Maintain backups for audits.</li>
                                                </ul>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3">Communication Checkpoints</h4>
                                            <div className="overflow-hidden rounded-xl border border-slate-200">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-slate-50 text-slate-900 font-bold border-b border-slate-200">
                                                        <tr>
                                                            <th className="px-4 py-3">Stage</th>
                                                            <th className="px-4 py-3">Communication</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        <tr><td className="px-4 py-2 font-medium text-slate-700">Contract Executed</td><td className="px-4 py-2 text-slate-500">Confirm deadlines, next steps.</td></tr>
                                                        <tr><td className="px-4 py-2 font-medium text-slate-700">Inspection</td><td className="px-4 py-2 text-slate-500">Update on findings & repairs.</td></tr>
                                                        <tr><td className="px-4 py-2 font-medium text-slate-700">Appraisal</td><td className="px-4 py-2 text-slate-500">Notify of results/loan status.</td></tr>
                                                        <tr><td className="px-4 py-2 font-medium text-slate-700">Closing Day</td><td className="px-4 py-2 text-slate-500">Signing & possession guide.</td></tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-xl">
                                        <h5 className="font-bold text-rose-700 text-sm mb-2"><i className="fa-solid fa-triangle-exclamation mr-1"></i> Common Escrow Mistakes</h5>
                                        <div className="grid sm:grid-cols-2 gap-2 text-xs text-rose-800 font-medium">
                                            <span>• Missing deposit deadlines.</span>
                                            <span>• Miscommunication between parties.</span>
                                            <span>• Failing to track contingencies.</span>
                                            <span>• Overlooking HOA/municipal rules.</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Compliance & Risk */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Compliance & Disclosure</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                                                <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                                                    <i className="fa-solid fa-file-circle-check text-indigo-500"></i> Disclosure Timing
                                                </div>
                                                <p className="text-sm text-slate-600">Provide required disclosures (lead paint, HOA, condition) before offers or as mandated. Track delivery dates.</p>
                                            </div>
                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                                                <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                                                    <i className="fa-solid fa-folder-open text-indigo-500"></i> Documentation
                                                </div>
                                                <p className="text-sm text-slate-600">Keep digital records of all reports and correspondence. File chronologically for easy audit retrieval.</p>
                                            </div>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                                            <h4 className="font-bold text-slate-900 mb-4 border-b pb-2">Red Flags to Watch</h4>
                                            <ul className="space-y-3 text-sm text-slate-600">
                                                <li className="flex gap-3"><i className="fa-solid fa-xmark text-rose-500 mt-1"></i> Unreported water damage/mold.</li>
                                                <li className="flex gap-3"><i className="fa-solid fa-xmark text-rose-500 mt-1"></i> Missing/Incomplete HOA docs.</li>
                                                <li className="flex gap-3"><i className="fa-solid fa-xmark text-rose-500 mt-1"></i> Unpermitted renovations.</li>
                                                <li className="flex gap-3"><i className="fa-solid fa-xmark text-rose-500 mt-1"></i> MLS vs. Title discrepancies.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Timeline Example */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Contract-to-Close Timeline</h3>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute top-0 bottom-0 left-4 w-0.5 bg-slate-100"></div>
                                        <div className="space-y-6 relative">
                                            {[
                                                { day: 'Day 0', task: 'Contract Signed', detail: 'Deposit received, deadlines confirmed.' },
                                                { day: 'Day 3-5', task: 'Inspections', detail: 'Home inspection scheduled, disclosures delivered.' },
                                                { day: 'Day 7-14', task: 'Negotiation', detail: 'Repairs negotiated, appraisal ordered.' },
                                                { day: 'Day 15-30', task: 'Processing', detail: 'Mortgage underwriting, contingency removal.' },
                                                { day: 'Day 30-45', task: 'Pre-Closing', detail: 'Title review, final walkthrough.' },
                                                { day: 'Closing', task: 'Transfer', detail: 'Funds transferred, keys delivered!' }
                                            ].map((item, i) => (
                                                <div key={i} className="flex gap-4 items-start">
                                                    <div className="w-8 h-8 rounded-full bg-white border-2 border-emerald-500 flex items-center justify-center z-10 font-bold text-[10px] text-emerald-600 shrink-0">
                                                        {i + 1}
                                                    </div>
                                                    <div className="pt-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-slate-900 text-sm">{item.task}</span>
                                                            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500">{item.day}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500">{item.detail}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                            <i className="fa-solid fa-list-check"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight">Risk Reduction Checklist</h3>
                                            <p className="text-indigo-200">Protect Your License & Clients</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {[
                                            'Use master checklist for all deadlines',
                                            'Schedule structured communication updates',
                                            'Document every disclosure & inspection securely',
                                            'Identify red flags (mold, permits) early',
                                            'Follow state laws & get client acknowledgments',
                                            'Maintain professional liability insurance'
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                                </div>
                                                <span className="text-lg font-medium text-slate-200">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'education_positioning' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Education & High Authority Positioning</h2>
                                <p className="text-lg text-slate-500 font-medium">Elevate Your Brand: First-Time Buyers, Luxury & Investors.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Generic advice is everywhere. To stand out, you must position yourself as a specialized authority. By providing deep, structured education for specific niches—like first-time buyers, luxury clients, or investors—you build trust that leads to higher-quality clients and referrals.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. First-Time Buyer Frameworks */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">First-Time Buyer Education Frameworks</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3">Key Concepts to Simplify</h4>
                                            <p className="text-sm text-slate-600 mb-4">First-time buyers are overwhelmed. Be their translator.</p>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 text-xs"><i className="fa-solid fa-1"></i></div>
                                                    <div>
                                                        <span className="font-bold text-slate-900 text-sm">The "All-In" Monthly Cost</span>
                                                        <p className="text-xs text-slate-500">Explain PITI (Principal, Interest, Taxes, Insurance) + Maintenance. Don't just quote the mortgage.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 text-xs"><i className="fa-solid fa-2"></i></div>
                                                    <div>
                                                        <span className="font-bold text-slate-900 text-sm">The "Upfront" Cash</span>
                                                        <p className="text-xs text-slate-500">Break down Down Payment vs. Closing Costs vs. Reserves.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 text-xs"><i className="fa-solid fa-3"></i></div>
                                                    <div>
                                                        <span className="font-bold text-slate-900 text-sm">Contingencies as Protection</span>
                                                        <p className="text-xs text-slate-500">Frame inspections and appraisals as "exit ramps" to reduce fear.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3">SEO Strategy: "How to Explain..."</h4>
                                            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                                                <h5 className="font-bold text-blue-800 text-sm mb-2">Target Keywords</h5>
                                                <ul className="space-y-2 text-xs text-blue-900 mb-4 font-medium">
                                                    <li>• "First time home buyer process [City]"</li>
                                                    <li>• "Step by step guide to buying a home"</li>
                                                    <li>• "Hidden costs of buying a home"</li>
                                                </ul>
                                                <h5 className="font-bold text-blue-800 text-sm mb-2">Content Idea</h5>
                                                <p className="text-xs text-blue-800 leading-relaxed italic">
                                                    "Create a 'Roadmap to Homeownership' infographic. Walk clients through it in your first meeting. Consistency builds authority."
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Niche Positioning: Luxury, Investor, Relocation */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Niche Expertise Best Practices</h3>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-6">
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all group">
                                            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform"><i className="fa-solid fa-gem"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Luxury Market</h4>
                                            <div className="text-xs text-slate-500 space-y-2">
                                                <p><span className="font-bold text-slate-700">Focus:</span> Lifestyle & Exclusivity.</p>
                                                <p><span className="font-bold text-slate-700">Best Practice:</span> Use high-end video storytelling. Focus on privacy and amenities (wine cellars, smart home tech).</p>
                                                <p><span className="font-bold text-slate-700">Key Phrase:</span> "Curated Living"</p>
                                            </div>
                                        </div>
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all group">
                                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform"><i className="fa-solid fa-chart-pie"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Investors</h4>
                                            <div className="text-xs text-slate-500 space-y-2">
                                                <p><span className="font-bold text-slate-700">Focus:</span> ROI, Cap Rate, Cash Flow.</p>
                                                <p><span className="font-bold text-slate-700">Best Practice:</span> Speak the language of numbers. Know rental rates and zoning. Source off-market deals.</p>
                                                <p><span className="font-bold text-slate-700">Key Phrase:</span> "Asset Perfomance"</p>
                                            </div>
                                        </div>
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all group">
                                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform"><i className="fa-solid fa-truck-moving"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Relocation</h4>
                                            <div className="text-xs text-slate-500 space-y-2">
                                                <p><span className="font-bold text-slate-700">Focus:</span> Schools, Commute, Community.</p>
                                                <p><span className="font-bold text-slate-700">Best Practice:</span> Offer virtual tours and neighborhood guides using Google Maps. Be their 'boots on the ground'.</p>
                                                <p><span className="font-bold text-slate-700">Key Phrase:</span> "Seamless Transition"</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Authority Content Strategy */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Authority Content Strategy</h3>
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-6 items-center">
                                        <div className="flex-1 space-y-4">
                                            <p className="text-sm text-slate-600 leading-relaxed">
                                                To rank for high-intent searches (SEO), you must answer specific questions better than anyone else. Niche content has <span className="font-bold text-indigo-600">less competition</span> and <span className="font-bold text-indigo-600">higher conversion</span>.
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                    <div className="text-xs font-bold text-slate-400 uppercase">Generic (Hard to rank)</div>
                                                    <div className="text-sm font-bold text-slate-500 line-through">"Homes for sale"</div>
                                                </div>
                                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                                    <div className="text-xs font-bold text-emerald-600 uppercase">Authority (High Intent)</div>
                                                    <div className="text-sm font-bold text-emerald-800">"Best schools in [Neighborhood]"</div>
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                    <div className="text-xs font-bold text-slate-400 uppercase">Generic (Hard to rank)</div>
                                                    <div className="text-sm font-bold text-slate-500 line-through">"Sell my house"</div>
                                                </div>
                                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                                    <div className="text-xs font-bold text-emerald-600 uppercase">Authority (High Intent)</div>
                                                    <div className="text-sm font-bold text-emerald-800">"Seller closing costs in [City]"</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 w-full md:w-1/3 text-center">
                                            <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center text-white text-xl mx-auto mb-4 shadow-lg shadow-rose-200">
                                                <i className="fa-solid fa-crown"></i>
                                            </div>
                                            <h4 className="font-black text-rose-900 mb-2">The "Google" Rule</h4>
                                            <p className="text-xs text-rose-800 leading-relaxed">
                                                "If you can't write 1,000 words on it that is 10x better than the top result, don't write it. Aim for depth, original data, and local insight."
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Checklist */}
                                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                            <i className="fa-solid fa-lightbulb"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight">Authority Action Plan</h3>
                                            <p className="text-indigo-200">Stop Selling, Start Educating</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {[
                                            'Create a "First-Time Buyer Roadmap" PDF',
                                            'Write 3 blog posts on specific neighborhood schools',
                                            'Film a "Cost of Living" video for your city',
                                            'Build a "Relocation Guide" landing page',
                                            'Development a "Market Data" newsletter for investors'
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                                </div>
                                                <span className="text-lg font-medium text-slate-200">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'branding_development' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Professional Development & Branding</h2>
                                <p className="text-lg text-slate-500 font-medium">Build Your Brand, Network & Productivity.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Success is about more than closing deals—it's about professional growth and personal branding. By investing in your brand, building a strong network, and mastering time management, you attract better leads and build a sustainable business.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. Personal Branding */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Personal Branding Best Practices</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                                                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3">
                                                    <i className="fa-solid fa-camera"></i>
                                                </div>
                                                <h4 className="font-bold text-slate-900 mb-2">Visual Identity</h4>
                                                <p className="text-sm text-slate-600">Invest in pro headshots and lifestyle photos. Maintain consistent colors/logos across all social platforms.</p>
                                            </div>
                                            <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                                                <div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-lg flex items-center justify-center mb-3">
                                                    <i className="fa-solid fa-bullhorn"></i>
                                                </div>
                                                <h4 className="font-bold text-slate-900 mb-2">Messaging & PR</h4>
                                                <p className="text-sm text-slate-600">Define your niche (Luxury, First-Time). Publish guest posts, speak at events, and highlight certifications.</p>
                                            </div>
                                        </div>
                                        <div className="bg-gradient-to-br from-indigo-600 to-blue-600 p-6 rounded-2xl text-white shadow-xl">
                                            <h4 className="font-bold text-xl mb-4 border-b border-white/20 pb-4">Social Media Consistency</h4>
                                            <ul className="space-y-4 text-sm font-medium text-indigo-50">
                                                <li className="flex gap-3 items-center"><i className="fa-brands fa-instagram text-xl"></i> Share client success stories & personal insights.</li>
                                                <li className="flex gap-3 items-center"><i className="fa-brands fa-linkedin text-xl"></i> Post market updates & thought leadership.</li>
                                                <li className="flex gap-3 items-center"><i className="fa-solid fa-quote-left text-xl"></i> "People buy from people they know, like, and trust."</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Networking */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Networking & Relationships</h3>
                                    </div>
                                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-4 border border-slate-200 rounded-xl text-center hover:bg-slate-50 transition-colors">
                                            <div className="text-3xl text-emerald-500 mb-3"><i className="fa-solid fa-handshake"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-1">Local Events</h4>
                                            <p className="text-xs text-slate-500">Chamber meetings, community gatherings.</p>
                                        </div>
                                        <div className="p-4 border border-slate-200 rounded-xl text-center hover:bg-slate-50 transition-colors">
                                            <div className="text-3xl text-amber-500 mb-3"><i className="fa-solid fa-briefcase"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-1">Partnerships</h4>
                                            <p className="text-xs text-slate-500">Lenders, designers, relocation services.</p>
                                        </div>
                                        <div className="p-4 border border-slate-200 rounded-xl text-center hover:bg-slate-50 transition-colors">
                                            <div className="text-3xl text-blue-500 mb-3"><i className="fa-solid fa-users-rectangle"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-1">Associations</h4>
                                            <p className="text-xs text-slate-500">NAR, local boards for mentorship.</p>
                                        </div>
                                        <div className="p-4 border border-slate-200 rounded-xl text-center hover:bg-slate-50 transition-colors">
                                            <div className="text-3xl text-rose-500 mb-3"><i className="fa-solid fa-address-book"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-1">Log It</h4>
                                            <p className="text-xs text-slate-500">Track contacts and follow-up religiously.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Time Management */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Time Management & Productivity</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8 items-center">
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-4">The "High-Value" Rule</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                                                    <span className="font-bold text-emerald-800 text-sm">Client Calls & Showings</span>
                                                    <span className="px-2 py-1 bg-emerald-200 text-emerald-800 text-xs rounded-full font-bold">$$$</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                                                    <span className="font-bold text-emerald-800 text-sm">Negotiating Contracts</span>
                                                    <span className="px-2 py-1 bg-emerald-200 text-emerald-800 text-xs rounded-full font-bold">$$$</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg opacity-60">
                                                    <span className="font-bold text-slate-600 text-sm">Social Media Scroll</span>
                                                    <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded-full font-bold">$0</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg opacity-60">
                                                    <span className="font-bold text-slate-600 text-sm">Admin Work (Delegate)</span>
                                                    <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded-full font-bold">$</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><i className="fa-solid fa-clock text-slate-400"></i> Daily Routine Prototype</h4>
                                            <ul className="space-y-4 text-sm text-slate-600">
                                                <li className="flex gap-3">
                                                    <span className="font-mono text-indigo-500 font-bold w-16">08:00 AM</span>
                                                    <span>Planning & Focused Work (No Email)</span>
                                                </li>
                                                <li className="flex gap-3">
                                                    <span className="font-mono text-indigo-500 font-bold w-16">10:00 AM</span>
                                                    <span>Lead Follow-Up Blocks</span>
                                                </li>
                                                <li className="flex gap-3">
                                                    <span className="font-mono text-indigo-500 font-bold w-16">01:00 PM</span>
                                                    <span>Appointments & Showings</span>
                                                </li>
                                                <li className="flex gap-3">
                                                    <span className="font-mono text-indigo-500 font-bold w-16">04:00 PM</span>
                                                    <span>Admin Wrap-Up & Prep for Tomorrow</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                            <i className="fa-solid fa-ranking-star"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight">Top Performer Checklist</h3>
                                            <p className="text-indigo-200">Scale Your Brand & Business</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {[
                                            'Update headshots & social media branding',
                                            'Define your unique value proposition',
                                            'Attend one local networking event weekly',
                                            'Maintain a networking log of contacts',
                                            'Time-block high-value activities daily',
                                            'Review performance metrics weekly'
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                                </div>
                                                <span className="text-lg font-medium text-slate-200">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'market_analytics' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Market Knowledge & Analytics</h2>
                                <p className="text-lg text-slate-500 font-medium">Data-Driven Insights, CMAs, and Investment Strategy.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Strong market knowledge separates top performers from average agents. By mastering local analysis, CMAs, and investment metrics, you provide undeniable value, build credibility, and command higher fees.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. Market Analysis */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Local Market Analysis</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Data Sources</h4>
                                                <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                                    <li>MLS: Sales history, active listings.</li>
                                                    <li>Public Records: Ownership, taxes.</li>
                                                    <li>Gov Planning Sites: Zoning, future projects.</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 mb-2">Key Metrics to Track</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {['Median Price', 'Price/SqFt', 'Days on Market', 'Inventory Levels', 'Absorption Rate'].map(tag => (
                                                        <span key={tag} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold border border-slate-200">{tag}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                                            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><i className="fa-solid fa-city text-indigo-500"></i> Neighborhood Insights</h4>
                                            <p className="text-sm text-slate-600 mb-4">Don't just sell the house, sell the data.</p>
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                                                    <i className="fa-solid fa-school text-blue-400"></i>
                                                    <span className="text-sm font-medium text-slate-700">School Ratings & Boundaries</span>
                                                </div>
                                                <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                                                    <i className="fa-solid fa-road text-amber-400"></i>
                                                    <span className="text-sm font-medium text-slate-700">Commute Times & Infrastructure</span>
                                                </div>
                                                <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                                                    <i className="fa-solid fa-chart-line text-emerald-400"></i>
                                                    <span className="text-sm font-medium text-slate-700">Appreciation Trends</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. CMA Best Practices */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Comparative Market Analysis (CMA)</h3>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-6">
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all">
                                            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3"><i className="fa-solid fa-filter"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Selection</h4>
                                            <p className="text-xs text-slate-500">3-6 comparable properties. Similar size, age, condition. Mix of Active (Competition) vs. Sold (Reality).</p>
                                        </div>
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all">
                                            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3"><i className="fa-solid fa-sliders"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Adjustments</h4>
                                            <p className="text-xs text-slate-500">Factor for SqFt, upgrades, lot size, and views. Account for market momentum (rising/falling).</p>
                                        </div>
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all">
                                            <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3"><i className="fa-solid fa-presentation-screen"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Presentation</h4>
                                            <p className="text-xs text-slate-500">Use visual charts. Be transparent about methodology to build trust. Provide a price range, not just a number.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Investment Education */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Investment Knowledge</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-4">Core Investment Metrics</h4>
                                            <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                                                <div className="p-3 border-b border-slate-200 flex justify-between items-center">
                                                    <span className="font-bold text-xs text-slate-500 uppercase">Cap Rate</span>
                                                    <span className="text-sm font-mono text-slate-700">NOI / Purchase Price</span>
                                                </div>
                                                <div className="p-3 border-b border-slate-200 flex justify-between items-center">
                                                    <span className="font-bold text-xs text-slate-500 uppercase">Cash-on-Cash</span>
                                                    <span className="text-sm font-mono text-slate-700">Cash Flow / Cash Invested</span>
                                                </div>
                                                <div className="p-3 flex justify-between items-center">
                                                    <span className="font-bold text-xs text-slate-500 uppercase">GRM</span>
                                                    <span className="text-sm font-mono text-slate-700">Price / Gross Rent</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-3 italic">"Investors care about the numbers. Be the agent who can calculate them."</p>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                                                <h5 className="font-bold text-emerald-800 text-sm mb-1"><i className="fa-solid fa-file-invoice-dollar mr-2"></i> Tax & Risk</h5>
                                                <p className="text-xs text-emerald-800 leading-relaxed">Understand 1031 Exchanges, depreciation, and capital gains (basic level). Identify risks like vacancy rates and major cap-ex items.</p>
                                            </div>
                                            <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                                                <h5 className="font-bold text-purple-800 text-sm mb-1"><i className="fa-solid fa-magnifying-glass-chart mr-2"></i> Property Eval</h5>
                                                <p className="text-xs text-purple-800 leading-relaxed">Analyze neighborhood rent trends, vacancy rates, and 'path of progress' development.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                            <i className="fa-solid fa-chart-simple"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight">Market Authority Checklist</h3>
                                            <p className="text-indigo-200">Know Your Numbers</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {[
                                            'Review MLS hot sheets daily',
                                            'Create a monthly market update video',
                                            'Build a standard CMA template with charts',
                                            'Learn to calculate Cap Rate & Cash-on-Cash',
                                            'Subscribe to local planning/zoning alerts',
                                            'Share neighborhood guides with school ratings'
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                                </div>
                                                <span className="text-lg font-medium text-slate-200">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'niche_market' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Niche Market Positioning</h2>
                                <p className="text-lg text-slate-500 font-medium">Best Practices for Realtors: Eco, Senior & Investment.</p>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                                <p className="text-indigo-800 leading-relaxed font-medium">
                                    Specializing in niche markets allows Realtors to differentiate themselves, command higher fees, and attract clients seeking expert guidance. By positioning yourself strategically in areas like eco-friendly homes, multi-generational housing, and short-term rentals, you provide value that generic agents cannot.
                                </p>
                            </div>

                            <div className="space-y-12">
                                {/* 1. Eco-Friendly */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">1</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Eco-Friendly & Sustainable Home Marketing</h3>
                                    </div>
                                    <p className="text-slate-600 mb-6">Green homes are in demand. Buyers prioritize efficiency, low impact, and savings.</p>

                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                                <h4 className="font-bold text-emerald-900 mb-2">Best Practices</h4>
                                                <ul className="space-y-2 text-sm text-emerald-800 list-disc list-inside">
                                                    <li><span className="font-bold">Highlight Features:</span> Solar, high-efficiency HVAC, smart thermostats.</li>
                                                    <li><span className="font-bold">Show Savings:</span> Include utility cost comparisons.</li>
                                                    <li><span className="font-bold">Certifications:</span> LEED, GreenPoint, local standards.</li>
                                                    <li><span className="font-bold">Incentives:</span> Identify tax credits and rebates.</li>
                                                </ul>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                <h4 className="font-bold text-slate-900 mb-2">Marketing Strategies</h4>
                                                <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                                    <li><span className="font-bold">SEO:</span> "green home selling tips", "eco-friendly real estate".</li>
                                                    <li><span className="font-bold">Content:</span> Blogs on sustainability benefits.</li>
                                                    <li><span className="font-bold">Visuals:</span> Tours emphasizing green features.</li>
                                                </ul>
                                            </div>
                                            <div className="p-3 bg-emerald-100 text-emerald-800 text-xs rounded-lg font-bold">
                                                Pro Tip: Use before-and-after cost comparisons to show long-term savings and appeal to eco-conscious buyers.
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Multi-Generational */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">2</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Multi-Generational & Senior Housing</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3">Best Practices</h4>
                                            <div className="space-y-3">
                                                <div className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                                                    <div className="font-bold text-sm text-slate-900 mb-1">Accessibility</div>
                                                    <p className="text-xs text-slate-500">Single-level, wide doors, ramps, grab bars. Safety first.</p>
                                                </div>
                                                <div className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                                                    <div className="font-bold text-sm text-slate-900 mb-1">Local Resources</div>
                                                    <p className="text-xs text-slate-500">Proximity to healthcare, senior centers, family amenities.</p>
                                                </div>
                                                <div className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                                                    <div className="font-bold text-sm text-slate-900 mb-1">Financing/Legal</div>
                                                    <p className="text-xs text-slate-500">VA loans, reverse mortgages, estate planning awareness.</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 mb-3">Marketing Strategy</h4>
                                            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                                                <ul className="space-y-3 text-sm text-blue-900">
                                                    <li className="flex gap-2"><i className="fa-solid fa-magnifying-glass mt-1"></i> "selling homes to seniors", "multi-gen buyer tips"</li>
                                                    <li className="flex gap-2"><i className="fa-solid fa-video mt-1"></i> Video tours highlighting accessibility.</li>
                                                    <li className="flex gap-2"><i className="fa-solid fa-chalkboard-user mt-1"></i> <span className="font-bold">Pro Tip:</span> Offer educational workshops or webinars for families navigating multi-generational housing decisions — this builds authority and generates leads.</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Short-Term Rentals */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">3</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Short-Term Rentals (STR) & Vacation</h3>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-6">
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all">
                                            <div className="text-3xl text-emerald-500 mb-3"><i className="fa-solid fa-coins"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">ROI Analysis</h4>
                                            <p className="text-xs text-slate-500">Project cash flow, occupancy rates, seasonal income vs. management costs.</p>
                                        </div>
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all">
                                            <div className="text-3xl text-rose-500 mb-3"><i className="fa-solid fa-gavel"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Regulations</h4>
                                            <p className="text-xs text-slate-500">Zoning, HOA restrictions, permits, occupancy taxes. Be the compliance expert.</p>
                                        </div>
                                        <div className="p-5 border border-slate-100 rounded-xl hover:shadow-lg transition-all">
                                            <div className="text-3xl text-amber-500 mb-3"><i className="fa-solid fa-umbrella-beach"></i></div>
                                            <h4 className="font-bold text-slate-900 mb-2">Marketing</h4>
                                            <p className="text-xs text-slate-500">"Airbnb investment guide". Highlight seasonality and local property management options.</p>
                                        </div>
                                    </div>
                                    <div className="mt-6 text-center">
                                        <span className="inline-block bg-amber-50 text-amber-800 text-xs font-bold px-4 py-2 rounded-full border border-amber-100">
                                            Pro Tip: Create a downloadable “Vacation Home Investment Guide” with ROI calculators, seasonality tips, and local regulation checklists — perfect for lead capture.
                                        </span>
                                    </div>
                                </div>

                                {/* 4. Long Term Benefits */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <span className="font-bold text-lg">4</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900">Winning with Niche Positioning</h3>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        {[
                                            { title: 'High Intent', text: 'Attracts motivated clients seeking specific expertise.' },
                                            { title: 'Less Competition', text: 'Focus on underserved segments generic agents ignore.' },
                                            { title: 'Premium Pricing', text: 'Specialization supports higher commissions.' },
                                            { title: 'Market Authority', text: 'Become the go-to expert in your targeted field.' }
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                                                <i className="fa-solid fa-star text-purple-500 mt-1"></i>
                                                <div>
                                                    <div className="font-bold text-slate-900 text-sm">{item.title}</div>
                                                    <div className="text-xs text-slate-500">{item.text}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                                            <i className="fa-solid fa-bullseye"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black tracking-tight">Quick SEO-Friendly Takeaways</h3>
                                            <p className="text-indigo-200">Actionable Steps for Growth</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {[
                                            'Highlight energy efficiency & savings for eco-homes',
                                            'Emphasize accessibility & community for seniors',
                                            'Offer ROI analysis & reg guidance for investors',
                                            'Use long-tail keywords in your content',
                                            'Create downloadable niche guides for lead capture'
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-3">
                                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                                </div>
                                                <span className="text-sm font-medium text-slate-200">{item}</span>
                                            </div>
                                        ))}
                                    </div>
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
