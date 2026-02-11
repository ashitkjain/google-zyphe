import React from 'react';

const CotalityCaseStudy: React.FC = () => (
    <div className="space-y-8 text-slate-600 bg-white p-8 md:p-12 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 text-[10px] font-black uppercase tracking-widest">Case Study</div>
                <h2 className="text-3xl font-serif font-black text-slate-900">Cotality – Solving the Real Estate "Identity Crisis"</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-slate-100">
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Company</div>
                    <div className="text-sm font-bold text-slate-900">Cotality (formerly CoreLogic)</div>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Sector</div>
                    <div className="text-sm font-bold text-slate-900">Property Intelligence</div>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Objective</div>
                    <div className="text-sm font-bold text-slate-900">"Single Source of Truth"</div>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Innovation</div>
                    <div className="text-sm font-bold text-slate-900">The CLIP® ID</div>
                </div>
            </div>
        </div>

        {/* Key Takeaways */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-10 border-b border-slate-100">
            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                <div>
                    <div className="text-xs font-black text-indigo-600 uppercase mb-2">Key Takeaway #1</div>
                    <div className="text-base text-slate-900 font-bold">Customers want unified source of data</div>
                </div>
                <div className="pt-4 border-t border-indigo-200/50">
                    <div className="text-[11px] font-black text-indigo-500 uppercase mb-1">Zyphe's approach</div>
                    <p className="text-sm leading-relaxed text-indigo-700/80 italic font-medium">The "Zyphe Fabric" unifies fragmented property and leads intelligence into one stream.</p>
                </div>
            </div>
            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                <div>
                    <div className="text-xs font-black text-indigo-600 uppercase mb-2">Key Takeaway #2</div>
                    <div className="text-base text-slate-900 font-bold">Move AI to the Data</div>
                </div>
                <div className="pt-4 border-t border-indigo-200/50">
                    <div className="text-[11px] font-black text-indigo-500 uppercase mb-1">Zyphe's approach</div>
                    <p className="text-sm leading-relaxed text-indigo-700/80 italic font-medium">Zyphe doesn't require user to upload data to run AI.</p>
                </div>
            </div>
            <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4">
                <div>
                    <div className="text-xs font-black text-indigo-600 uppercase mb-2">Key Takeaway #3</div>
                    <div className="text-base text-slate-900 font-bold">Explainable AI is Critical</div>
                </div>
                <div className="pt-4 border-t border-indigo-200/50">
                    <div className="text-[11px] font-black text-indigo-500 uppercase mb-1">Zyphe's approach</div>
                    <p className="text-sm leading-relaxed text-indigo-700/80 italic font-medium">Zyphe's context graph would show the reason behind a recommendation</p>
                </div>
            </div>
        </div>

        <section className="space-y-4">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">Executive Summary</h3>
            <p className="text-base leading-relaxed text-slate-600">
                Cotality rebranded from CoreLogic in 2025, transforming into a "Property Intelligence Powerhouse." By 2026, the company has addressed the industry's most significant hurdle: <span className="text-indigo-600 font-bold">fragmentation.</span> Through its proprietary CLIP® ID and CoreAI infrastructure, Cotality unifies over <span className="text-slate-900 font-medium">5.5 billion records</span> across 22,000 sources, providing a 360-degree view of 99.9% of all U.S. properties.
            </p>
        </section>

        <section className="space-y-4">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">The Challenge: The Property "Identity Crisis"</h3>
            <p className="text-base leading-relaxed text-slate-600">
                Before Cotality’s intervention, a single property often existed as dozens of disconnected records. A tax record might use "St." while an insurance file used "Street," and a mortgage application used a parcel number.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-red-50 border border-red-100 rounded-2xl">
                    <div className="text-xs font-black text-red-600 uppercase mb-2">The Impact</div>
                    <p className="text-sm text-slate-600 leading-relaxed">Fragmentation caused "market lag," where institutional investors and agents lost billions in potential deals due to slow manual reconciliation.</p>
                </div>
                <div className="p-6 bg-red-50 border border-red-100 rounded-2xl">
                    <div className="text-xs font-black text-red-600 uppercase mb-2">The Problem</div>
                    <p className="text-sm text-slate-600 leading-relaxed">AI models fed with this fragmented data produced "AI Slop"—hallucinated property values and inaccurate risk assessments.</p>
                </div>
            </div>
        </section>

        <section className="space-y-6">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">The Solution: A Universal "VIN" for Homes</h3>
            <div className="space-y-6">
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-black text-slate-900 text-base">1. The CLIP® ID & Snowflake Integration</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        Instead of moving data back and forth, Cotality launched the <span className="text-indigo-600 font-medium">CLIP App for Snowflake AI Data Cloud</span>. This allows for native processing on internal data, instant deduplication, and matching records with a persistent identity that remains constant even if address changes.
                    </p>
                </div>
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-black text-slate-900 text-base">2. CoreAI: Intelligence with an Address</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        A layered AI framework designed for high-stakes decision-making. Utilizes Computer Vision & LiDAR to detect roof condition, pool presence, and square footage. For Realtors, this reduces listing creation from <span className="text-slate-900 font-medium">hours to seconds</span>.
                    </p>
                </div>
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="font-black text-slate-900 text-base">3. Agentic AI Partnerships (Google Cloud)</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        In late 2025, partnered with <span className="text-slate-900 font-bold">Google Cloud</span> to launch the "Payoff Analysis Agent" on Gemini Enterprise. This allows AI agents to collaborate using Cotality’s data to predict portfolio risk in real-time.
                    </p>
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
                            <th className="p-6 font-black uppercase tracking-widest text-slate-500">Outcome / Impact</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <tr>
                            <td className="p-6 text-slate-900 font-bold">Market Coverage</td>
                            <td className="p-6 text-slate-600">99.9% of all U.S. properties tracked</td>
                        </tr>
                        <tr>
                            <td className="p-6 text-slate-900 font-bold">Productivity</td>
                            <td className="p-6 text-indigo-600 font-black">90% reduction in manual data entry</td>
                        </tr>
                        <tr>
                            <td className="p-6 text-slate-900 font-bold">Institutional Speed</td>
                            <td className="p-6 text-slate-600">Decision cycles shrunk from weeks to minutes</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
);

export default CotalityCaseStudy;
