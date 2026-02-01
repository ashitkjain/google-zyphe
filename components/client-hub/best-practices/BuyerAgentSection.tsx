import React from 'react';

const BuyerAgentSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Buyer Agent Best Practices</h2>
                <p className="text-lg text-slate-500 font-medium">A professional, client-first approach to guiding homebuyers from first showing to closing day.</p>
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
    );
};

export default BuyerAgentSection;
