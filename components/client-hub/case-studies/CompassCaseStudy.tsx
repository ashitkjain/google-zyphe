import React from 'react';

const CompassCaseStudy: React.FC = () => (
    <div className="space-y-8 text-slate-600 bg-white p-8 md:p-12 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 text-[10px] font-black uppercase tracking-widest">Case Study</div>
                <h2 className="text-3xl font-serif font-black text-slate-900">Compass – The Architecture of a Unified "PropOS"</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-slate-100">
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Company</div>
                    <div className="text-sm font-bold text-slate-900">Compass, Inc.</div>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Sector</div>
                    <div className="text-sm font-bold text-slate-900">Residential Real Estate</div>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Challenge</div>
                    <div className="text-sm font-bold text-slate-900">Fragmented Workflows</div>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Solution</div>
                    <div className="text-sm font-bold text-slate-900">$1.5B+ "PropOS"</div>
                </div>
            </div>
        </div>

        {/* Key Takeaways */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-10 border-b border-slate-100">
            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                <div>
                    <div className="text-xs font-black text-indigo-600 uppercase mb-2">Key Takeaway #1</div>
                    <div className="text-base text-slate-900 font-bold">Data should not have to be re-entered</div>
                </div>
                <div className="pt-4 border-t border-indigo-200/50">
                    <div className="text-[11px] font-black text-indigo-500 uppercase mb-1">Zyphe's approach</div>
                    <p className="text-sm leading-relaxed text-indigo-700/80 italic font-medium">Auto-populates cross-platform records via a single entry point.</p>
                </div>
            </div>
            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                <div>
                    <div className="text-xs font-black text-indigo-600 uppercase mb-2">Key Takeaway #2</div>
                    <div className="text-base text-slate-900 font-bold">Agents want to run their entire business via voice</div>
                </div>
                <div className="pt-4 border-t border-indigo-200/50">
                    <div className="text-[11px] font-black text-indigo-500 uppercase mb-1">Zyphe's approach</div>
                    <p className="text-sm leading-relaxed text-indigo-700/80 italic font-medium">Hands-free tour scheduling and lead updates via Zyphe Voice.</p>
                </div>
            </div>
            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                <div>
                    <div className="text-xs font-black text-indigo-600 uppercase mb-2">Key Takeaway #3</div>
                    <div className="text-base text-slate-900 font-bold">Visual discovery matters</div>
                </div>
                <div className="pt-4 border-t border-indigo-200/50">
                    <div className="text-[11px] font-black text-indigo-500 uppercase mb-1">Zyphe's approach</div>
                    <p className="text-sm leading-relaxed text-indigo-700/80 italic font-medium">Interactive "Zyphe Boards" transform property search into a visual discovery engine.</p>
                </div>
            </div>
        </div>

        <section className="space-y-4">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">Executive Summary</h3>
            <p className="text-base leading-relaxed text-slate-600">
                When traditional brokerages struggled with agent burnout due to fragmented third-party tools, Compass invested heavily in a unified platform. By consolidating CRM, MLS data, and AI-driven marketing into a single "Source of Truth," Compass achieved a <span className="text-indigo-600 font-bold">97.5% agent retention rate</span> and a <span className="text-indigo-600 font-bold">21% year-over-year revenue growth</span> (Q2 2025), significantly outperforming the broader market.
            </p>
        </section>

        <section className="space-y-4">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">The Challenge: The "Integration Tax"</h3>
            <p className="text-base leading-relaxed text-slate-600">
                Before 2025, the average Realtor managed over <span className="text-slate-900 font-bold">20 browser tabs</span> to complete a single transaction. Data silos—where the CRM didn't talk to the MLS, and the MLS didn't talk to the marketing suite—created a hidden "Integration Tax" on time. NAR 2025 data suggests this fragmentation was the #1 source of frustration for agents.
            </p>
        </section>

        <section className="space-y-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">The Strategy: The "End-to-End" Ecosystem</h3>
            <div className="space-y-6">
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-black text-slate-900 text-base">1. Unified Data Fabric</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Instead of connecting separate tools via APIs (which often break), Compass built a <span className="text-slate-950 font-medium">Common Data Fabric</span> using Databricks and AWS. This allowed them to auto-sync leads from luxury websites instantly to the CRM and standardize "dirty" data from hundreds of MLS feeds for AI processing.
                    </p>
                </div>
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 space-y-6">
                    <h4 className="font-black text-slate-900 text-base">2. Agentic AI & Predictive Analytics</h4>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <div className="text-xs font-black text-indigo-600 uppercase">"Likely to Sell" Model</div>
                            <p className="text-sm text-slate-500 italic">Analyzes homeowner behavior (market trends, public records, social cues) to predict listings. Agents using this tool doubled their commission revenue.</p>
                        </div>
                        <div className="space-y-2">
                            <div className="text-[10px] font-black text-indigo-600 uppercase">Compass Make-Me-Sell</div>
                            <p className="text-xs text-slate-500 italic">Privacy-first "aspirational price" setting. 19,000+ homeowners entered this stealth-selling funnel by Q3 2025.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section className="space-y-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">The Results (2025–2026 Data)</h3>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="p-6 font-black uppercase tracking-widest text-slate-500">Metric</th>
                            <th className="p-6 font-black uppercase tracking-widest text-slate-500">Performance Impact</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <tr>
                            <td className="p-6 text-slate-900 font-bold">Agent Productivity</td>
                            <td className="p-6 text-slate-500">20% increase in deals closed per agent</td>
                        </tr>
                        <tr>
                            <td className="p-6 text-slate-900 font-bold">Time-to-Sale</td>
                            <td className="p-6 text-slate-500">15% faster than market average</td>
                        </tr>
                        <tr>
                            <td className="p-6 text-slate-900 font-bold">Revenue (Q2 2025)</td>
                            <td className="p-6 text-indigo-600 font-black">$2.06 Billion (up 21.1% YoY)</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
);

export default CompassCaseStudy;
