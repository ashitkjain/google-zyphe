import React from 'react';

const LeadGenerationSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Modern Lead Generation</h2>
                <p className="text-lg text-slate-500 font-medium">Strategic approaches to building a consistent sales pipeline.</p>
            </div>


            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                <p className="text-indigo-800 leading-relaxed font-medium">
                    Consistent growth relies on a steady stream of leads. Successful agents master both inbound (digital presence, content) and outbound (networking, prospecting) strategies to keep their pipeline full.
                </p>
            </div>

            <div className="space-y-12">
                {/* 1. Digital Presence */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <span className="font-bold text-lg">1</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Optimizing Your Digital Presence</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">Social Media Strategy</h4>
                            <p className="text-sm text-slate-600 mb-3">Be where your clients are. Consistency builds trust.</p>
                            <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                <li><span className="font-bold">Instagram/TikTok:</span> Visuals, tours, quick tips.</li>
                                <li><span className="font-bold">LinkedIn:</span> Market data, professional networking.</li>
                                <li><span className="font-bold">Facebook:</span> Community groups, events.</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">Website & SEO</h4>
                            <p className="text-sm text-slate-600 mb-3">Your 24/7 storefront.</p>
                            <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                <li>Ensure mobile responsiveness.</li>
                                <li>Add local neighborhood guides.</li>
                                <li>Feature client testimonials prominently.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 2. Content Marketing */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                            <span className="font-bold text-lg">2</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Content Marketing: Provide Value</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { type: 'Educational', ex: 'First-time buyer guides, steps to selling.' },
                            { type: 'Market Data', ex: 'Monthly reports, interest rate updates.' },
                            { type: 'Lifestyle', ex: 'Best coffee shops, park reviews.' },
                            { type: 'Success Stories', ex: 'Sold listings, client wins.' }
                        ].map((item, i) => (
                            <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="font-bold text-indigo-700 mb-1">{item.type}</div>
                                <div className="text-xs text-slate-500">{item.ex}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Networking & Sphere */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <span className="font-bold text-lg">3</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Networking & Sphere of Influence (SOI)</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">Nurture Your SOI</h4>
                            <p className="text-sm text-slate-600">Your past clients and friends are your best source of referrals.</p>
                            <ul className="mt-2 space-y-1 text-sm text-slate-500 pl-4 border-l-2 border-emerald-200">
                                <li>Quarterly check-in calls.</li>
                                <li>Personal notes on birthdays/anniversaries.</li>
                                <li>Client appreciation events.</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">Strategic Partnerships</h4>
                            <p className="text-sm text-slate-600">Align with local businesses.</p>
                            <ul className="mt-2 space-y-1 text-sm text-slate-500 pl-4 border-l-2 border-emerald-200">
                                <li>Lenders & mortgage brokers.</li>
                                <li>Contractors & interior designers.</li>
                                <li>Divorce attorneys & estate planners.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 4. Lead Capture & Follow-Up */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                            <span className="font-bold text-lg">4</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Capture & Conversion</h3>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1">
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-2">
                                <div className="font-bold text-amber-900">Landing Pages</div>
                                <div className="text-amber-700 text-sm">Offer value (e.g., "Free Home Valuation") in exchange for contact info.</div>
                            </div>
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                <div className="font-bold text-amber-900">CRM Automation</div>
                                <div className="text-amber-700 text-sm">Automate immediate follow-up texts for new leads. Speed to lead is key!</div>
                            </div>
                        </div>
                        <div className="w-full md:w-1/3 bg-slate-900 text-white p-6 rounded-xl text-center">
                            <div className="text-3xl font-black text-amber-400 mb-1">5 Min</div>
                            <div className="text-sm opacity-80">Ideal response time to web leads.</div>
                        </div>
                    </div>
                </div>

                {/* Summary / Checklist */}
                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                            <i className="fa-solid fa-bullseye"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black tracking-tight">Lead Gen Checklist</h3>
                            <p className="text-indigo-200">Daily Actions</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {[
                            'Post 1 valuable piece of content on social media',
                            'Contact 5 people in your SOI (Sphere of Influence)',
                            'Review and respond to new web leads immediately',
                            'Update your CRM with notes and next steps',
                            'Monitor local market news to share with leads'
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
    );
};

export default LeadGenerationSection;
