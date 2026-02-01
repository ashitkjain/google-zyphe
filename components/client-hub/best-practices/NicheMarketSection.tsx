import React from 'react';

const NicheMarketSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Niche Market Expertise</h2>
                <p className="text-lg text-slate-500 font-medium">Developing specialized authority in high-value segments.</p>
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
    );
};

export default NicheMarketSection;
