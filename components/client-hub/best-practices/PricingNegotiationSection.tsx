import React from 'react';

const PricingNegotiationSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Pricing & Negotiation Standards</h2>
                <p className="text-lg text-slate-500 font-medium">Strategic guidance for valuation and deal-making excellence.</p>
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
    );
};

export default PricingNegotiationSection;
