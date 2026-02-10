
import React from 'react';
import { HubTab } from './hub/HubHeader';

interface ProductMarketFitTabProps {
    setActiveTab?: (tab: HubTab) => void;
}

const ProductMarketFitTab: React.FC<ProductMarketFitTabProps> = ({ setActiveTab }) => {
    const marketFitData = [
        { category: 'CRM', leaders: 'Follow Up Boss, kvCORE, HubSpot', pricing: '$60 - $500 /user/mo', market: '$2.55 Billion', cagr: '12.2%', driver: '62% of US agencies have now adopted a formal CRM.' },
        { category: 'Closing', leaders: 'Luxury Presence, Chime, iHomefinder', pricing: '$200 - $1,500 /mo', market: '$1.15 Billion', cagr: '11.4%', driver: 'Fast adoption of "Breeze" (automated) disclosures and e-signatures.' },
        { category: 'IDX', leaders: 'SkySlope, Dotloop, Lone Wolf', pricing: '$30 - $100 /file', market: '$3.80 Billion*', cagr: '10.3%', driver: 'Shift toward "Search-as-a-Service" and AI-driven lead scoring.' },
    ];

    const pillars = [
        {
            id: 1,
            title: 'Experience',
            focus: 'Removing the "Admin Tax" and making data entry a byproduct of conversation.',
            features: [
                { name: 'Universal Ingest', desc: 'AI engine that instantly sanitizes and maps legacy CSVs, PDFs, and CRM data, eliminating manual entry.' },
                { name: 'Conversational Command', desc: 'Natural language for database querying and agentic task execution via chatbot interface.' },
                { name: 'The "Home Story" Portal', desc: 'An intuitive and delightful experience offering a seamless "all-in-one" journey or a plug-and-play setup that prevents manual data copy and entry.' }
            ],
            color: 'bg-indigo-500'
        },
        {
            id: 2,
            title: 'Functionality',
            focus: 'A modular, AI-native suite designed to replace legacy fragmentation with a single, high-speed ecosystem.',
            features: [
                { name: 'All-in-One + Modular', desc: 'A complete "business-in-a-box" (CRM, IDX, Closing) that can also function as a "no-friction" plug-in.' },
                { name: 'Vision & Spatial AI', desc: 'Bridges the industry "blind spot" by analyzing listing photos and maps for condition, geo-spatial intelligence, and neighborhood data.' },
                { name: 'Post-Closing Engagement', desc: 'Automatically transforms transaction data into an Automated Maintenance Roadmap and ROI tracker.' },
                { name: 'Reactivation Engine', desc: 'Agentic AI that proactively "mines" dormant databases to revive cold leads using real-time market triggers.' },
                { name: 'Realtor Tools', desc: 'Integrated calendar, tasks, scratchpads, calculators, reminders, and note-taking abilities.' }
            ],
            color: 'bg-emerald-500'
        },
        {
            id: 3,
            title: 'Technology',
            focus: 'A reasoning web that connects fragmented data into a single source of truth.',
            features: [
                { name: 'Reasoning Web', desc: 'Multi-layered context graph architecture unifying visual, geospatial, and behavioral data.' },
                { name: 'Rapid Development (20x Velocity)', desc: 'Leverages advanced code assistants and cloud-native infrastructure for ultra-low-cost, high-velocity deployment.' },
                { name: 'Grounded LLMs', desc: 'Advanced models with real-time search grounding that outperform traditional AI by utilizing live market data.' },
                { name: 'Vision-to-Data Mapping', desc: 'Proprietary models converting raw image pixels into searchable property features.' },
                { name: 'Hybrid Integration Layer', desc: 'High-speed API infrastructure for instant "plug-and-play" compatibility with legacy real estate software.' }
            ],
            color: 'bg-slate-900'
        }
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-600 w-fit">
                    <i className="fa-solid fa-bullseye"></i>
                    Strategic Positioning 2026
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">Product Market Fit & Strategy</h1>
                <p className="text-slate-500 font-medium max-w-3xl leading-relaxed">
                    Zyphe is positioned at the intersection of high-growth real estate segments, capturing value through a unified,
                    AI-native ecosystem that addresses the "Admin Tax" and fragmentation of legacy tools.
                </p>
            </div>

            {/* US Market Overview Table */}
            <section className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                    <i className="fa-solid fa-earth-americas text-indigo-500"></i>
                    US Market Landscape & Opportunity
                </h3>
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Category</th>
                                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Leaders</th>
                                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">US Market</th>
                                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">CAGR</th>
                                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Key Driver</th>
                            </tr>
                        </thead>
                        <tbody>
                            {marketFitData.map((row, i) => (
                                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="text-sm font-black text-slate-900">{row.category}</div>
                                        <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{row.pricing}</div>
                                    </td>
                                    <td className="px-8 py-6 text-xs text-slate-600 font-medium">{row.leaders}</td>
                                    <td className="px-8 py-6 text-sm font-black text-indigo-600">{row.market}</td>
                                    <td className="px-8 py-6">
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-md text-[10px] font-black">
                                            <i className="fa-solid fa-arrow-up-right"></i>
                                            {row.cagr}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-xs text-slate-500 font-medium italic leading-relaxed">{row.driver}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Zyphe Product Strategy - EFT */}
            <section className="space-y-8">
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Zyphe’s Product Strategy - EFT</h2>
                    <p className="text-sm text-slate-500 font-medium">Experience, Functionality, and Technology approach.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {pillars.map((pillar) => (
                        <div key={pillar.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-8 flex flex-col gap-8 relative overflow-hidden group hover:border-indigo-200 transition-all duration-300">
                            <div className={`absolute top-0 left-0 w-2 h-full ${pillar.color}`}></div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Pillar 0{pillar.id}</span>
                                    <div className={`w-10 h-10 rounded-2xl ${pillar.color} flex items-center justify-center text-white text-sm shadow-lg`}>
                                        <i className={`fa-solid ${pillar.id === 1 ? 'fa-wand-magic-sparkles' : pillar.id === 2 ? 'fa-puzzle-piece' : 'fa-microchip'}`}></i>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-slate-900">{pillar.title}</h3>
                                <p className="text-xs text-indigo-600 font-bold leading-relaxed">{pillar.focus}</p>
                            </div>

                            <div className="space-y-6 flex-1">
                                {pillar.features.map((feature, i) => (
                                    <div key={i} className="space-y-1 group/item">
                                        <h4 className="text-[11px] font-black text-slate-900 group-hover/item:text-indigo-600 transition-colors uppercase tracking-wider">{feature.name}</h4>
                                        <p className="text-[10px] text-slate-500 leading-relaxed font-medium">{feature.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Gap Analysis / Competitor Deep Dive */}
            <section className="space-y-12">
                <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 blur-[120px] rounded-full -mr-32 -mt-32"></div>

                    <div className="relative z-10 space-y-12">
                        <div className="flex flex-col gap-4 max-w-4xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-400 w-fit">
                                <i className="fa-solid fa-magnifying-glass-chart"></i>
                                Gap Analysis
                            </div>
                            <h2 className="text-3xl font-black tracking-tight">Addressing "The Mining Gap"</h2>
                            <p className="text-slate-400 text-sm font-medium leading-relaxed">
                                27.5% of agents operate without any formal automation. 38% find legacy platforms too bloated or expensive.
                                Agents spend 19% of their time on admin entry, yet still lose 73% of leads due to a lack of "Agentic AI."
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[
                                { name: 'Follow Up Boss', strength: 'Simplicity & Open API', share: '350k+ Agents / 20%', focus: 'Speed & Integrations', gap: 'Lacks native behavioral depth; fails to re-surface cold leads automatically.' },
                                { name: 'kvCORE', strength: 'Total Automation Suite', share: 'Brokerage Provided / 12%', focus: 'Native Lead Gen', gap: 'Clunky mobile experience and slower tool innovation due to bloat.' },
                                { name: 'HubSpot', strength: 'Enterprise Scalability', share: 'Generic CRM / 5%', focus: 'Complex Data Logic', gap: 'General-purpose tool requires heavy setup for RE-specific MLS/Property data.' }
                            ].map((comp, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-6 hover:bg-white/10 transition-colors">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-indigo-400">{comp.name}</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{comp.strength}</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-500 uppercase font-black tracking-widest">Market Share</span>
                                            <span className="text-white font-bold">{comp.share}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-500 uppercase font-black tracking-widest">AI Capability</span>
                                            <span className="text-indigo-300 font-bold">{comp.focus}</span>
                                        </div>
                                    </div>
                                    <div className="pt-6 border-t border-white/5 space-y-2">
                                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-rose-400/80">Strategic Gap</span>
                                        <p className="text-[11px] text-slate-300 leading-relaxed font-medium italic">"{comp.gap}"</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Zyphe Advantage Footer */}
            <div className="bg-indigo-600 rounded-[2.5rem] p-12 text-white flex flex-col items-center text-center gap-6 shadow-2xl shadow-indigo-200">
                <div className="w-16 h-16 rounded-3xl bg-white/20 flex items-center justify-center text-2xl">
                    <i className="fa-solid fa-gem"></i>
                </div>
                <h2 className="text-3xl font-black tracking-tight">Zyphe Advantage / USP</h2>
                <p className="max-w-2xl text-indigo-100 font-medium leading-relaxed">
                    Built a simple and easy to use, all digital, closing platform like DotLoop, which is moving towards
                    building client engagement for boosting repeat clients and long-term retention.
                </p>
                <div className="flex gap-4 mt-4">
                    <div className="px-6 py-3 bg-white text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                        Digital-Native Closing
                    </div>
                    <button
                        onClick={() => setActiveTab?.('post_close_intelligence')}
                        className="px-6 py-3 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 hover:bg-white hover:text-indigo-600 transition-all shadow-lg active:scale-95"
                    >
                        Post-Closing Intelligence
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductMarketFitTab;
