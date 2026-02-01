import React from 'react';

const SellerAgentSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Seller Agent Best Practices</h2>
                <p className="text-lg text-slate-500 font-medium">Providing high-end representation for listings to maximize results.</p>
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
    );
};

export default SellerAgentSection;
