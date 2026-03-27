import React from 'react';

const UnitEconomicsTab: React.FC = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
            <header className="space-y-4">
                <div className="flex items-center gap-6 text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">
                    <span>Investor Confidential</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    <span>Unit Economics & Scalability v1.0</span>
                </div>
                <h1 className="text-5xl font-serif font-black text-slate-900 leading-[1.1] tracking-tight max-w-5xl">
                    High-Margin <span className="text-indigo-600">Unit Economics</span>
                </h1>
                <p className="text-xl text-slate-500 font-medium leading-relaxed">
                    By leveraging advanced GenAI efficiency and offshore operational models, Zyphe achieves enterprise-grade innovation at a fraction of traditional R&D costs.
                </p>
            </header>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 1. Zyphe AI Model Efficiency */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:border-indigo-200 transition-all flex flex-col space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-2xl font-serif font-black text-slate-900">Zyphe AI Model Efficiency</h3>
                        <p className="text-sm text-slate-500 font-medium">Pricing per 1M tokens (Standard Market Rates)</p>
                    </div>

                    <div className="space-y-6">
                        <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-xs text-indigo-600 uppercase tracking-widest">Zyphe AI</h4>
                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[8px] font-black uppercase">Core</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium font-sans">Input (Text/Img/Vid)</span>
                                    <span className="font-black text-slate-900">$0.30</span>
                                </div>
                                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                                    <span className="text-slate-900 font-black font-sans uppercase text-[10px]">Output (+ Thinking)</span>
                                    <span className="font-black text-indigo-600">$2.50</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 rounded-3xl space-y-4 border border-slate-100">
                            <div className="flex items-center justify-between">
                                <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest">Flash Lite</h4>
                                <span className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded text-[8px] font-black uppercase">Edge</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium font-sans">Input (Text/Img/Vid)</span>
                                    <span className="font-black text-slate-900">$0.10</span>
                                </div>
                                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
                                    <span className="text-slate-900 font-black font-sans uppercase text-[10px]">Output (+ Thinking)</span>
                                    <span className="font-black text-slate-400">$0.40</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Core Operational Costs */}
                <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                        <i className="fa-solid fa-calculator text-8xl text-indigo-400"></i>
                    </div>

                    <div className="relative space-y-8">
                        <h3 className="text-2xl font-serif font-black text-white">Platform Core</h3>

                        <div className="space-y-6">
                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 flex-none"><i className="fa-solid fa-house-circle-check"></i></div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-sm">Property Analysis: ~$0.20</h5>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Analyzing ~50 images per property using cached results. Enabling context-aware synthesis.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 flex-none"><i className="fa-solid fa-robot"></i></div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-sm">Chatbot Interactivity: 0.1¢ / msg</h5>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Agentic queries using Flash Lite. Hyper-low transactional cost per user session.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 flex-none"><i className="fa-solid fa-comment-dots"></i></div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-sm">Communication (Telnyx): $0.001 / msg</h5>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">SMS/Voice overhead allowing for massive reach at minimal scale. $1/mo per number.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 flex-none"><i className="fa-solid fa-cloud"></i></div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-sm">Infrastructure: Near-Zero</h5>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Small data footprint makes scaling efficient across Google Cloud native services.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Fully Digital Closing Services */}
                <div className="bg-emerald-950 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                        <i className="fa-solid fa-signature text-8xl text-emerald-400"></i>
                    </div>

                    <div className="relative space-y-8">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-serif font-black text-white italic">Digital Closing</h3>
                            <p className="text-xs text-emerald-400/60 font-black uppercase tracking-widest">Transaction Refined</p>
                        </div>

                        <div className="space-y-6">
                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-none"><i className="fa-solid fa-file-signature"></i></div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-sm">E-Signatures (SignNow): $0.15 / doc</h5>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Legally binding digital execution via enterprise API. Fractional transactional cost.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-none"><i className="fa-solid fa-video"></i></div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-sm">Remote Notarization: ~$25 / session</h5>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">RON sessions Eliminate physical travel and courier fees. Direct digital chain of custody.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-none"><i className="fa-solid fa-id-card"></i></div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-sm">Identity (KYC): $1.50 / check</h5>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Biometric and document verification ensuring zero-fraud transactional security.</p>
                                </div>
                            </div>

                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-none"><i className="fa-solid fa-vault"></i></div>
                                <div className="space-y-1">
                                    <h5 className="font-black text-sm">Asset Vaulting: $5.00 / closing</h5>
                                    <p className="text-xs text-slate-400 font-medium leading-relaxed">Permanent eVault legal chain-of-custody (eOriginal) for the life of the asset.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Development & Support */}
            <section className="bg-indigo-50/50 border border-indigo-100/50 rounded-[2.5rem] p-8 lg:p-12 space-y-12">
                <div className="space-y-4 text-center max-w-3xl mx-auto">
                    <h3 className="text-3xl font-serif font-black text-slate-900">Capital Efficiency Model</h3>
                    <p className="text-slate-500 font-medium">Zyphe optimizes overhead through AI-led development and a lean global operational structure.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="p-8 bg-white border border-indigo-100 rounded-3xl shadow-sm space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <i className="fa-solid fa-bolt-lightning text-xl"></i>
                            </div>
                            <h4 className="font-black text-slate-900 text-lg">20X Dev Velocity</h4>
                        </div>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">Antigravity Ultra licenses ($300/mo) support massive development compression, slasher R&D timelines.</p>
                    </div>

                    <div className="p-8 bg-white border border-indigo-100 rounded-3xl shadow-sm space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <i className="fa-solid fa-user-gear text-xl"></i>
                            </div>
                            <h4 className="font-black text-slate-900 text-lg">Offshore Hub</h4>
                        </div>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">$500/mo per head for backoffice staff in India validating AI output and site data, ensuring 100% precision.</p>
                    </div>

                    <div className="p-8 bg-white border border-indigo-100 rounded-3xl shadow-sm space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <i className="fa-solid fa-network-wired text-xl"></i>
                            </div>
                            <h4 className="font-black text-slate-900 text-lg">Low-Cost API Ecosystem</h4>
                        </div>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">Built using commodity data layers from Google, Radar, and RapidAPI to minimize vendor lock-in and cost.</p>
                    </div>
                </div>
            </section>

            {/* Pilot Program Estimate */}
            <section className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent"></div>

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    <div className="lg:col-span-5 space-y-6">
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Financial Projection</h4>
                            <h3 className="text-4xl font-serif font-black">Bay Area <span className="text-indigo-400">Pilot Case</span></h3>
                        </div>
                        <p className="text-slate-400 font-medium leading-relaxed">
                            A focused pilot program across 10 Bay Area Realtors, serving 1,000 clients with 10,000 active listings demonstrates the scalability of our low-cost architecture.
                        </p>
                        <div className="space-y-4 pt-6">
                            <div className="flex justify-between items-center py-3 border-b border-white/10 uppercase tracking-widest font-black text-[10px]">
                                <span className="text-slate-400">Total Setup Cost</span>
                                <span className="text-2xl text-white font-sans font-black">$2,000</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 uppercase tracking-widest font-black text-[10px]">
                                <span className="text-indigo-400">Recurring Monthly Burn</span>
                                <span className="text-2xl text-indigo-400 font-sans font-black">$1,000/mo</span>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-7">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AI Processing (10K listings)</span>
                                <div className="text-xl font-black">$2,000</div>
                                <p className="text-[10px] text-slate-400 font-medium">One-time processing fee @ $0.20/ea</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Client Management</span>
                                <div className="text-xl font-black">$100</div>
                                <p className="text-[10px] text-slate-400 font-medium">Active CRM and Chatbot overhead</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Infrastructure + APIs</span>
                                <div className="text-xl font-black">$100</div>
                                <p className="text-[10px] text-slate-400 font-medium">Monthly Cloud/API usage projection</p>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Development + Staff</span>
                                <div className="text-xl font-black">$800</div>
                                <p className="text-[10px] text-slate-400 font-medium">Antigravity License + Offshore Support</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <section className="text-center pt-8 border-t border-slate-100 italic text-slate-400 font-medium text-sm">
                "Infinite scalability driven by low-cost machine intelligence."
            </section>
        </div>
    );
};

export default UnitEconomicsTab;
