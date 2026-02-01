import React from 'react';

const MarketAnalyticsSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Market Analytics & Timing</h2>
                <p className="text-lg text-slate-500 font-medium">Using data to predict trends and guide client investments.</p>
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
    );
};

export default MarketAnalyticsSection;
