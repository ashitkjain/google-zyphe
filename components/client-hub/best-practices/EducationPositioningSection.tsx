import React from 'react';

const EducationPositioningSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Professional Education & Positioning</h2>
                <p className="text-lg text-slate-500 font-medium">Elevating your market value through continuous learning and authority.</p>
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
    );
};

export default EducationPositioningSection;
