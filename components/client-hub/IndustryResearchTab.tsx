
import React from 'react';

const IndustryResearchTab: React.FC = () => {
    const metrics = [
        { label: 'Lead Conversion Rate', value: '1% – 9%', context: '1% for cold PPC leads; 7–9% for portal leads.' },
        { label: 'Leads Reactivation', value: '5% – 15%', context: 'Percentage of "dead" leads recovered via AI.' },
        { label: 'Cost Per Lead', value: '$25 – $500', context: '$25-$75 entry; $300-$500 luxury/commercial.' },
        { label: 'Lead Response Time', value: '< 5 Minutes', context: 'Industry gold standard; critical for conversion.' },
        { label: 'Lead-to-Opportunity', value: '3.6%', context: 'Percentage of raw leads that qualify as sales ops.' },
        { label: 'AI Engagement Lift', value: '35% – 50%', context: 'Increase in interactions vs manual outreach.' },
    ];

    const pricingMatrix = [
        { category: 'CRM', leaders: 'Follow Up Boss, kvCORE', pricing: '$60 - $500', gap: 'Few tools "mine" old databases with AI.' },
        { category: 'Web Presence', leaders: 'Luxury Presence, Chime', pricing: '$200 - $1,500', gap: 'Static search; need neighborhood sentiment scores.' },
        { category: 'Closing', leaders: 'SkySlope, Dotloop', pricing: '$30 - $100', gap: 'No bridge from "Sold" to "Home Intelligence".' },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            {/* Legend / Header */}
            <div className="flex flex-col gap-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-black uppercase tracking-[0.2em] text-indigo-600 w-fit">
                    <i className="fa-solid fa-microchip"></i>
                    Market Intelligence 2026
                </div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-tight">Real Estate Industry Research</h1>
                <p className="text-xl text-slate-500 font-medium max-w-4xl leading-relaxed">
                    The real estate sector is at an inflection point. Generative AI could add up to <span className="text-indigo-600 font-bold">$180 billion</span> in value, yet adoption remains staggered due to legacy tool complexity.
                </p>
            </div>

            {/* Key Problems Grid */}
            <section className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation text-rose-500"></i>
                    Key Industry Friction Points
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { title: 'AI Evolution Gap', desc: 'Difficulty keeping pace with rapid AI and data availability changes.' },
                        { title: 'Legacy Complexity', desc: 'Inadequate existing tools that fail to meet modern intelligence needs.' },
                        { title: 'Data Silos', desc: 'Friction across multiple tools requiring manual entry and sync.' },
                        { title: 'Entry Barriers', desc: 'High costs for advanced tools currently out of reach for small realtors.' }
                    ].map((p, i) => (
                        <div key={i} className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors">
                            <h4 className="font-black text-slate-900 text-base mb-2">{p.title}</h4>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">{p.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Market Dynamics & TAM */}
            <section className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <i className="fa-solid fa-globe text-indigo-500"></i>
                    Market Dynamics & TAM
                </h3>
                <div className="bg-indigo-50/30 rounded-[3rem] p-10 border border-indigo-100/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-chart-line text-sm"></i>
                                </div>
                                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Global Software</h4>
                            </div>
                            <div className="space-y-1">
                                <div className="text-2xl font-black text-indigo-600">$12.7 Billion</div>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Projected market size by 2029 is 29.3B.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-building-circle-check text-sm"></i>
                                </div>
                                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Global PropTech</h4>
                            </div>
                            <div className="space-y-1">
                                <div className="text-2xl font-black text-indigo-600">$44.59 Billion</div>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Including Fintech, construction tech, and asset management.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-users text-sm"></i>
                                </div>
                                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">US RE Brokerage Revenue</h4>
                            </div>
                            <div className="space-y-1">
                                <div className="text-2xl font-black text-indigo-600">$249.14 Billion</div>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Highly fragmented; top 5 firms hold &lt;25% market share.</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-robot text-sm"></i>
                                </div>
                                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">AI Adoption</h4>
                            </div>
                            <div className="space-y-1">
                                <div className="text-2xl font-black text-indigo-600">40% Growth</div>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">58% of U.S. firms already utilize AI-driven CRM systems.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 pt-10 border-t border-indigo-100/50 grid grid-cols-1 md:grid-cols-3 gap-12">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                                <i className="fa-solid fa-id-badge text-base"></i>
                            </div>
                            <div className="space-y-1">
                                <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">NAR Membership</h5>
                                <p className="text-sm font-black text-indigo-600">~1.5 Million Realtors</p>
                                <p className="text-[10px] text-slate-500 font-medium">Population remains stable despite interest rate fluctuations.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                                <i className="fa-solid fa-hourglass-half text-base"></i>
                            </div>
                            <div className="space-y-1">
                                <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Closing Effort</h5>
                                <p className="text-sm font-black text-indigo-600">15–20 Hours / File</p>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">Manual administrative tasks representing a <span className="text-rose-600 font-bold">30% "efficiency tax"</span>.</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                                <i className="fa-solid fa-wallet text-base"></i>
                            </div>
                            <div className="space-y-1">
                                <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Monthly IT Spend</h5>
                                <p className="text-sm font-black text-indigo-600">$50 – $500+/mo</p>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">34% spend $50–$250; top 20% of earners spend &gt;$500/mo.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Metrics & Benchmarks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <i className="fa-solid fa-chart-simple text-indigo-500"></i>
                        Performance Benchmarks (2026)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {metrics.map((m, i) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-[1.5rem] p-6 shadow-sm hover:border-indigo-200 transition-all relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-indigo-500/10 transition-colors"></div>
                                <div className="relative z-10 flex flex-col gap-1">
                                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{m.label}</span>
                                    <div className="text-2xl font-black text-slate-900">{m.value}</div>
                                    <p className="text-[10px] text-slate-500 font-medium mt-1 leading-relaxed">{m.context}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <i className="fa-solid fa-dollar-sign text-emerald-500"></i>
                        Pricing Framework
                    </h3>
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-8 space-y-6">
                        {[
                            { level: 'Entry Level', price: '$50–$150/mo', desc: 'Basic CRM, IDX templates, manual tasks.' },
                            { level: 'Growth / Pro', price: '$300–$800/mo', desc: 'AI lead scoring, automated drips, full CRM.' },
                            { level: 'Enterprise / Elite', price: '$1,500+/mo', desc: 'Custom IDX, Reactivation, seamless integrations.' }
                        ].map((p, i) => (
                            <div key={i} className="flex flex-col gap-1.5 pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">{p.level}</span>
                                    <span className="text-base font-black text-indigo-600">{p.price}</span>
                                </div>
                                <p className="text-sm text-slate-600 font-medium">{p.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tool Matrix */}
            <section className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <i className="fa-solid fa-layer-group text-slate-500"></i>
                    Tool Segmentation & Gaps
                </h3>
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 w-1/4">Category</th>
                                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 w-1/4">Leaders</th>
                                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 w-1/4">Pricing</th>
                                <th className="px-8 py-5 text-xs font-black uppercase tracking-widest text-slate-400 w-1/4">Key Gaps</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pricingMatrix.map((row, i) => (
                                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6 text-base font-black text-slate-900">{row.category}</td>
                                    <td className="px-8 py-6 text-sm text-slate-600 font-medium">{row.leaders}</td>
                                    <td className="px-8 py-6 text-sm text-slate-600 font-bold">{row.pricing}</td>
                                    <td className="px-8 py-6 text-sm text-indigo-600 font-medium italic">{row.gap}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* McKinsey Strategy */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <i className="fa-solid fa-graduation-cap text-indigo-500"></i>
                        The McKinsey "4 Cs" of Gen AI
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            { title: 'Customer Engagement', icon: 'fa-comments', list: ['Conversational chatbots', 'Real-time doubt removal', 'Personalized support'] },
                            { title: 'Creation', icon: 'fa-wand-magic-sparkles', list: ['Marketing copy drafting', 'Virtual apartment tours', 'Drafting architectural docs'] },
                            { title: 'Concision', icon: 'fa-compress-arrows-alt', list: ['Summarizing dense leases', 'Recorded call sentiment', 'Querying unstructured data'] },
                            { title: 'Coding Solutions', icon: 'fa-code', list: ['Legacy code translation', 'Data automation scripts', 'Interpreting complex bases'] },
                        ].map((c, i) => (
                            <div key={i} className="bg-indigo-50/50 p-7 rounded-[2rem] border border-indigo-100 flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <i className={`fa-solid ${c.icon} text-indigo-600 text-base`}></i>
                                    <h4 className="font-black text-slate-900 text-sm uppercase tracking-widest">{c.title}</h4>
                                </div>
                                <ul className="space-y-2">
                                    {c.list.map((item, j) => (
                                        <li key={j} className="text-xs text-slate-600 font-medium flex items-center gap-3">
                                            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                            <i className="fa-solid fa-rocket text-indigo-500"></i>
                            McKinsey Recommends
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold italic">"Zyphe provides these AI-as-a-service layers to accelerate industry-wide AI adoption"</p>
                    </div>
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                        {[
                            {
                                title: 'Data Strategy (Proprietary & Engineered Data)',
                                desc: 'Consolidate data in a firm-controlled "lakehouse" to maintain a single source of truth. Capture new data via IoT, computer vision, and tenant app interactions. Ensure robust data governance for performance.'
                            },
                            {
                                title: 'Prompt Engineering (Contextual Libraries)',
                                desc: 'Build a playbook of tested prompts for specific real estate tasks (e.g., lease renewal concessions). Use a rigorous testing process to refine syntax for predictable output.'
                            },
                            {
                                title: 'Tool Design (Action-Oriented Interfaces)',
                                desc: 'Launch self-service portals to encourage company-wide adoption and friction-free user engagement.'
                            },
                            {
                                title: 'Modern Tech Stack (Infrastructure & Safety)',
                                desc: 'Integrate vendor systems (PMS, CRM, maintenance) to eliminate data silos and harmonize existing workflows.'
                            },
                            {
                                title: 'Operating Model (Talent & Evolution)',
                                desc: 'Hire new roles (prompt/data engineers). Redefine existing roles to focus on high-value specialties while AI handles baseline administrative tasks.'
                            }
                        ].map((s, i) => (
                            <div key={i} className="flex gap-5">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-400 text-xs font-black">{i + 1}</div>
                                <div className="space-y-1">
                                    <h4 className="font-black text-slate-900 text-sm mb-1">{s.title}</h4>
                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* References */}
            <div className="pt-12 border-t border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Industry Sources</h4>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-bold text-slate-500">
                            <span className="hover:text-indigo-600 transition-colors">First Page Sage 2026</span>
                            <a href="https://www.nar.realtor/research-and-statistics/research-reports/realtor-technology-survey" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline underline-offset-4 transition-all">NAR Technology Survey</a>
                            <a href="https://www.deloitte.com/us/en/insights/industry/financial-services/financial-services-industry-outlooks/commercial-real-estate-outlook.html" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline underline-offset-4 transition-all">Deloitte Outlook</a>
                            <a href="https://www.mckinsey.com/industries/real-estate/our-insights/generative-ai-can-change-real-estate-but-the-industry-must-change-to-reap-the-benefits" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline underline-offset-4 transition-all">McKinsey AI Report</a>
                            <a href="https://www.pwc.com/us/en/industries/financial-services/asset-wealth-management/real-estate/emerging-trends-in-real-estate-pwc-uli.html" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline underline-offset-4 transition-all">PwC & ULI Emerging Trends</a>
                            <a href="https://www.jll.com/en-sa/insights/ai-for-business-growth-are-real-estate-investors-ready-to-gain-the-competitive-edge" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline underline-offset-4 transition-all">JLL AI Insights</a>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default IndustryResearchTab;
