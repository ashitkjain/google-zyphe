import React from 'react';

const RadiusCaseStudy: React.FC = () => (
    <div className="space-y-8 text-slate-600 bg-white p-8 md:p-12 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 text-[10px] font-black uppercase tracking-widest">Case Study</div>
                <h2 className="text-3xl font-serif font-black text-slate-900">Radius – The Rise of the "AI-First" White-Label Brokerage</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-slate-100">
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Company</div>
                    <div className="text-sm font-bold text-slate-900">Radius (formerly Radius Agent)</div>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Sector</div>
                    <div className="text-sm font-bold text-slate-900">Tech-Enabled Brokerage & SaaS</div>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Objective</div>
                    <div className="text-sm font-bold text-slate-900">Unified AI-Native OS</div>
                </div>
                <div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Innovation</div>
                    <div className="text-sm font-bold text-slate-900">Mel AI Assistant</div>
                </div>
            </div>
        </div>

        {/* Key Takeaways */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-8 border-b border-slate-100">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="text-[10px] font-black text-indigo-600 uppercase mb-2">Key Takeaway #1</div>
                <div className="text-xs text-slate-900 font-bold">"Ambient" AI is the Future</div>
            </div>
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="text-[10px] font-black text-indigo-600 uppercase mb-2">Key Takeaway #2</div>
                <div className="text-xs text-slate-900 font-bold">White-Labeling is a Magnet</div>
            </div>
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="text-[10px] font-black text-indigo-600 uppercase mb-2">Key Takeaway #3</div>
                <div className="text-xs text-slate-900 font-bold">Target "Admin Heavy" Workflows</div>
            </div>
        </div>

        <section className="space-y-4">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">Executive Summary</h3>
            <p className="text-sm leading-relaxed text-slate-600">
                As of 2026, Radius has positioned itself as the premier "Business-in-a-Box" for real estate entrepreneurs. Unlike traditional brokerages that offer tech as an afterthought, Radius is a <span className="text-indigo-600 font-bold">technology company with a brokerage license.</span> Their flagship AI assistant, <span className="text-slate-900 font-bold text-base font-serif">Mel</span>, automates roughly <span className="text-slate-900 font-bold">80% of back-office and administrative functions</span>, allowing teams to scale without the traditional "hiring tax." Following their $13M Series B in late 2023, Radius achieved triple-digit growth by focusing on the "unification" of CRM, compliance, and lead nurture.
            </p>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">The Challenge: The "Growth Bottleneck"</h3>
            <p className="text-sm leading-relaxed text-slate-600">
                For most high-producing team leads, growth traditionally meant hiring more administrative staff to handle manual data entry, compliance risk, and lead response times. Fragmentation—where agents struggled with "clunky, bolt-on systems" that didn't share data—created significant friction.
            </p>
        </section>

        <section className="space-y-6">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">The Solution: Mel AI – The "Supercharged Secretary"</h3>
            <div className="space-y-6">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <h4 className="font-black text-slate-900 text-sm">1. Automated "Ambient" Documentation</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        When an agent makes a call through the Radius app, Mel "listens" to automatically generate summaries, update the CRM, and schedule follow-ups. Agents save an estimated <span className="text-indigo-600 font-bold">8–12 hours per week</span> on manual data entry.
                    </p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <h4 className="font-black text-slate-900 text-sm">2. Proactive Lead Nurturing & Personalization</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Mel identifies as the "Agent's Assistant," proactively texting leads to collect search criteria and coordinate tours. It uses branded CMA reports to provide expert market insights instantly.
                    </p>
                </div>
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <h4 className="font-black text-slate-900 text-sm">3. White-Label Branding Strategy</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Radius provides the "pipes" (AI, license, compliance), but the agent's brand stays front and center. This approach has led to high loyalty among "Flagship Partners" who want to own their business identity.
                    </p>
                </div>
            </div>
        </section>

        <section className="space-y-4">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">The Results (2025–2026 Metrics)</h3>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="p-4 font-black uppercase tracking-widest text-slate-500">Metric</th>
                            <th className="p-4 font-black uppercase tracking-widest text-slate-500">Performance Impact</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        <tr>
                            <td className="p-4 text-slate-900 font-bold">Operational Overhead</td>
                            <td className="p-4 text-slate-500">80% reduction in back-office time</td>
                        </tr>
                        <tr>
                            <td className="p-4 text-slate-900 font-bold">Lead Conversion</td>
                            <td className="p-4 text-slate-500">3x higher conversion rate</td>
                        </tr>
                        <tr>
                            <td className="p-4 text-slate-900 font-bold">Agent Growth</td>
                            <td className="p-4 text-indigo-600 font-black">293% increase in agent base</td>
                        </tr>
                        <tr>
                            <td className="p-4 text-slate-900 font-bold">Revenue Growth</td>
                            <td className="p-4 text-indigo-600 font-black">330% increase in YoY revenue</td>
                        </tr>
                        <tr>
                            <td className="p-4 text-slate-900 font-bold">Compliance Speed</td>
                            <td className="p-4 text-slate-500">Audits and payouts are now "instantaneous"</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
);

export default RadiusCaseStudy;
