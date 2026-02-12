import React, { useState, useRef } from 'react';

interface ContextGraphPaperProps {
    p: {
        volume: string;
        date: string;
        title: string;
    };
    setActiveTab?: (tab: any) => void;
    onNavigate?: (view: any, path: string) => void;
}

const ContextGraphPaper: React.FC<ContextGraphPaperProps> = ({ p, setActiveTab, onNavigate }) => {
    const [showPlayer, setShowPlayer] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoUrl = "https://firebasestorage.googleapis.com/v0/b/zyphe-af0bf.firebasestorage.app/o/admin%2Fvideos%2F1770735496024_The_Why.mp4?alt=media&token=38f8d143-6574-4c25-874c-e8594ae7aeee";

    return (
        <article className="space-y-12 animate-in fade-in duration-500">
            <div className="space-y-6">

                <h2 className="text-4xl font-serif font-black text-slate-900 leading-tight max-w-4xl">
                    {p.title}
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                <div className="lg:col-span-12 space-y-12 text-[17px] leading-relaxed text-slate-700 font-medium">
                    <section className="space-y-6">
                        <p>In the real estate sector, a Context Graph will be the key to transform a standard property search from a simple "filter-by-features" experience into a powerful "decision-support" engine. As demonstrated by research, a{' '}
                            <button
                                onClick={() => {
                                    setActiveTab?.('technical_papers_recommender');
                                    onNavigate?.('technical_papers_recommender', '/realtor/technical_papers_recommender');
                                }}
                                className="text-indigo-600 font-black hover:underline underline-offset-4"
                            >
                                context based intelligent recommendation system
                            </button>{' '}
                            delivers higher recall, precision and coverage compared to traditional recommendation methods, while reducing searcher fatigue etc.
                            For a platform like Zyphe, applying a context graph means the AI doesn't just find a 3-bedroom house; it understands the rationale and historical context behind every step of user's home purchase journey.</p>
                        <p>Zyphe shifts real estate platform from being a "System of Record" to a "System of Intent," that understands the why behind every real estate move, enabling realtors to transition from reactive coordinators to proactive advisors.</p>
                    </section>

                    <section className="space-y-8">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                            <div className="lg:col-span-7">
                                <div
                                    onClick={() => setShowPlayer(true)}
                                    className="aspect-video w-full overflow-hidden rounded-[2.5rem] border border-slate-200 bg-slate-900 shadow-2xl group relative cursor-pointer"
                                >
                                    <video
                                        src={videoUrl}
                                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                                        muted
                                        onMouseOver={(e) => e.currentTarget.play()}
                                        onMouseOut={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-3xl border border-white/20 flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-all duration-500">
                                            <i className="fa-solid fa-play text-xl ml-1"></i>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-6 left-6">
                                        <div className="px-2 py-1 bg-indigo-600 rounded-md inline-block">
                                            <span className="text-[7px] font-black text-white uppercase tracking-widest">HD</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="lg:col-span-5 h-full">
                                <div className="h-full p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-center relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                                        <i className="fa-solid fa-bolt-lightning text-8xl text-indigo-400"></i>
                                    </div>
                                    <div className="space-y-6 relative">
                                        <div className="flex items-center gap-3 text-indigo-400">
                                            <i className="fa-solid fa-brain text-lg"></i>
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">System of Intent</span>
                                        </div>
                                        <p className="text-[20px] font-serif italic text-indigo-50 leading-snug">
                                            "Zyphe understands the 'why' behind every real estate move, enabling realtors to transition from reactive coordinators to proactive advisors."
                                        </p>
                                        <div className="h-px bg-white/10 w-full"></div>
                                        <p className="text-sm text-slate-400 leading-relaxed">
                                            Shifting from a standard "System of Record" to an intelligent engine that maps the entire customer journey.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Video Player Modal */}
                    {showPlayer && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
                            <div
                                className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
                                onClick={() => setShowPlayer(false)}
                            />
                            <div className="relative w-full max-w-6xl aspect-video bg-black rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    controls
                                    autoPlay
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute top-6 right-6 flex gap-3">
                                    <button
                                        onClick={() => setShowPlayer(false)}
                                        className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black shadow-xl transition-all hover:rotate-90 hover:bg-slate-100"
                                        title="Close Player"
                                    >
                                        <i className="fa-solid fa-times text-lg"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <section className="space-y-8">
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">Decision Factors</h3>
                        <div className="space-y-10">
                            {[
                                {
                                    n: "1. Environmental & Macro Context (The \"Constraints\")", d: "These are the external \"Ground Truths\" that dictate the boundaries of the transaction.", items: [
                                        "Geospatial Intelligence: Integrating Google Satellite/Maps for View Scoring (backyard outlook) and building footprint analysis for density/privacy.",
                                        "Market Grounding: Real-time ingestion of Economic Indicators (Fed rate shifts, local employment changes) and hyper-local news (e.g., new tech campuses).",
                                        "Safety & Climate Nodes: Automated Climate Scores (Flood, Fire, Heat) and Noise Maps (decibel tracking from highways, rail, or flight paths).",
                                        "Regulatory Guardrails: Real-time verification of RERA/Title status and current tax compliance (e.g., PAN/TDS reporting for high-value deals)."
                                    ]
                                },
                                {
                                    n: "2. Visual & Geospatial Intelligence (The \"Asset\")", d: "Using Zyphe’s vision models to \"see\" the physical utility and quality of the property.", items: [
                                        "Material & Condition Scoring: Detecting Luxury vs. Budget finishes (Marble vs. Laminate) and Wear & Tear (cracked paint, aging roof) to automate renovation budgeting.",
                                        "Solar & Energy Utility: Analyzing roof pitch, square footage, and irradiance for Solar Potential, plus detecting existing EV readiness.",
                                        "Yard & Privacy Analytics: Evaluating \"Backyard Utility\" (space for pools/ADUs) and calculating Privacy Metrics based on neighboring window alignments.",
                                        "Neighborhood Nodes: Integrating granular data for School Performance (ratings/sentiment), Walkability (actual pedestrian paths), and local amenity access."
                                    ]
                                },
                                {
                                    n: "3. Stakeholder Intent & Behavioral Context (The \"Why\")", d: "Capturing the \"Decision Trace\" of every interaction to map psychological intent.", items: [
                                        "Agent/Client Interaction Capture: Parsing \"Micro-Preferences\" from Slack, SMS (Telnyx), and Email to update the user's context graph in real-time.",
                                        "Rejection Rationale: Every \"Pass\" on a listing creates a Negative Precedent node (e.g., \"rejected due to street noise\"), which automatically filters future suggestions.",
                                        "Aesthetic Matching: Tagging architectural styles (Modern, Victorian) to align with buyer \"Intent Nodes\" and visual search history.",
                                        "Reactivation Triggers: Detecting \"Life Events\" (new child, job change) or Market Shifts (rates hitting a target) to proactively restart a journey."
                                    ]
                                },
                                {
                                    n: "4. Operational & Transactional Context (The \"Workflow\")", d: "Solving data fragmentation by creating a unified system of record for the closing.", items: [
                                        "Bitemporal Timeline: A unified record pulling from MLS, CRMs, and Escrow platforms to track how the deal evolved (price drops, contingency waivers).",
                                        "Decision Precedents: Tracking the \"How\" of past closings (e.g., \"waived inspection due to all-cash competition\") to guide future bidding strategies.",
                                        "Financial Feasibility: Real-time PITI (Principal, Interest, Taxes, Insurance) calculation against the buyer's specific DTI (Debt-to-Income) and current mortgage rate locks.",
                                        "Policy Compliance: Linking every \"Agentic Action\" to current brokerage and legal policies (10DLC/TCPA) to ensure the workflow is audit-ready."
                                    ]
                                }
                            ].map((s, i) => (
                                <div key={i} className="space-y-4">
                                    <h4 className="text-[16px] font-black text-slate-900 border-b border-slate-100 pb-2">{s.n}</h4>
                                    <p className="text-[15px] text-slate-500 font-bold mb-4">{s.d}</p>
                                    <ul className="space-y-3 list-none">
                                        {s.items.map((item, j) => (
                                            <li key={j} className="flex gap-4 text-[15px]">
                                                <span className="text-slate-300 font-black">•</span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Technical Logic Table - Full Width */}
                <div className="lg:col-span-12 py-10 border-t border-slate-100">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-900 mb-8">Technical Logic: Decision Traces</h3>
                    <div className="border border-slate-200 rounded-sm overflow-hidden">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-400 uppercase tracking-widest">
                                <tr>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Primary Nodes</th>
                                    <th className="p-4">The Decision Trace (Edge/Rationale)</th>
                                    <th className="p-4">Agentic Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                                {[
                                    { t: "Environmental", n: "AcousticNode, PropertyNode", e: "Tranquility Breach: Connects Buyer to negative sentiment for Acoustic node.", a: "Zyphe 'mutes' future listings within noise radius." },
                                    { t: "Visual", n: "MaterialNode, PriceNode", e: "Quality Discrepancy: Flags mismatch between Asking Price and Material Quality.", a: "Generates 'Negotiation Alert' for lower offer." },
                                    { t: "Behavioral", n: "IntentNode, UtilityNode", e: "Furry Friend Intent: Links Buyer to Yard Utility nodes.", a: "Prioritizes listings with fenced-perimeter detection." },
                                    { t: "Macro", n: "MarketNode, DTI_Node", e: "Threshold Breach: Re-calculates DTI for dormant leads on rate drop.", a: "Triggers Reactivation Event: 'Now within budget.'" },
                                    { t: "Operational", n: "TimelineNode, SellerNode", e: "Liquidity Shift: Connects Property to a 'Motivated Seller' intent edge.", a: "Alerts Buyer agent that seller leverage has weakened." }
                                ].map((row, i) => (
                                    <tr key={i}>
                                        <td className="p-4 text-indigo-600 uppercase font-black">{row.t}</td>
                                        <td className="p-4 text-slate-400">{row.n}</td>
                                        <td className="p-4 italic text-slate-900">{row.e}</td>
                                        <td className="p-4 font-black">{row.a}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Graph Theory Sections */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-16 pb-10">
                    <section className="space-y-6">
                        <h3 className="text-xl font-black text-slate-900">How the Graph "Thinks" with Traces</h3>
                        <p className="text-[16px]">The Context Graph treats every decision as a directed edge. This creates a feedback loop where the factors continuously refine the traces.</p>
                        <ul className="space-y-4 text-[15px] border-l-2 border-slate-900 pl-6">
                            <li><strong>Observation:</strong> A buyer views 3 homes with "Modern" architecture but "Passes" on all of them.</li>
                            <li><strong>Factor Correlation:</strong> Zyphe's Visual Intelligence notices all 3 had "Open Concept" floor plans, but the buyer's Behavioral Trace mentioned needing a "Quiet Home Office."</li>
                            <li><strong>Graph Inference:</strong> The system creates a Conflict Node. It realizes the buyer likes the Modern Style (Visual) but hates the Open Layout (Behavioral).</li>
                            <li><strong>The Trace Output:</strong> The next recommendation is "Modern Architecture" but with "Divided Living Spaces."</li>
                        </ul>
                    </section>

                    <section className="space-y-6">
                        <h3 className="text-xl font-black text-slate-900">Why "Graph" is the only way to scale</h3>
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <h4 className="text-sm font-black uppercase tracking-widest leading-none">Multi-Hop Reasoning</h4>
                                <p className="text-[15px]">Allows Zyphe to "travel" through connections to find non-obvious answers (e.g., why Maria stopped looking due to specific highway construction news).</p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-sm font-black uppercase tracking-widest leading-none">Bitemporal Connectivity</h4>
                                <p className="text-[15px]">Maintains a "History of Truth." If a house price drops, the graph shows the Event Node (e.g., Interest Rate Hike) that caused the change.</p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Comparison Table */}
                <div className="lg:col-span-12 py-10 border-y border-slate-100">
                    <h3 className="text-xl font-black text-slate-900 mb-8">Graph vs. Traditional CRM</h3>
                    <div className="border border-slate-200 rounded-sm overflow-hidden max-w-3xl">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-400 uppercase tracking-widest">
                                <tr><th className="p-4">Feature</th><th className="p-4">Traditional CRM</th><th className="p-4">Zyphe Context Graph</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[
                                    { f: "Data Structure", t: "Tables & Rows (Rigid)", z: "Nodes & Edges (Flexible)" },
                                    { f: "Discovery", t: "\"Find 3-bed houses.\"", z: "\"Find houses that feel like the one Maria liked.\"" },
                                    { f: "Intelligence", t: "Requires manual entry.", z: "Infers from photos, news, and chat." },
                                    { f: "Search", t: "Keyword-based.", z: "Context-based (Reasoning through the web)." }
                                ].map((row, i) => (
                                    <tr key={i} className="font-bold text-[13px]">
                                        <td className="p-4 text-slate-400 uppercase tracking-widest">{row.f}</td>
                                        <td className="p-4 text-slate-500">{row.t}</td>
                                        <td className="p-4 text-slate-900">{row.z}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Technical Stack Section */}
                <div className="lg:col-span-12 pt-10 grid grid-cols-1 md:grid-cols-2 gap-16">
                    <section className="space-y-6">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">The Technical Stack</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { h: "Graph Database", p: "Neo4j or AWS Neptune for relationship storage." },
                                { h: "Vector Database", p: "Pinecone or Milvus for visual embeddings." },
                                { h: "LLM Engine", p: "Reasoning and extraction models." },
                                { h: "Orchestrator", p: "Google Cloud 'Brain' for chat-to-graph translation." }
                            ].map((stack, i) => (
                                <div key={i} className="p-4 bg-slate-50 rounded-sm">
                                    <span className="text-[13px] font-black block text-slate-900">{stack.h}</span>
                                    <span className="text-[12px] text-slate-500">{stack.p}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Perfect Match Query</h3>
                        <div className="bg-slate-900 p-6 rounded-sm text-indigo-300 font-mono text-[10px] whitespace-pre overflow-x-auto">
                            {`// 1. Find the Property
MATCH (p:Property {id: "402_Maple_St"})
// 2. Identify Context (Visual & Env)
MATCH (p)-[:HAS_STYLE]->(s:Style {type: "Modern Minimalist"})
MATCH (p)-[:HAS_ENVIRONMENT]->(e:Env {type: "High Noise"})
// 3. Find Matching Buyers
MATCH (b:Buyer)-[:PREFERS]->(s)
// 4. FILTER OUT Noise Constraints
WHERE NOT (b)-[:DECISION_TRACE]->(:Constraint {type: "High Noise"})
// 5. Check Rate vs Budget
MATCH (m:Macro {type: "Interest_Rate"})
WHERE b.target_rate >= m.current_value
RETURN b.name, s.type, "Rate Satisfied"`}
                        </div>
                    </section>
                </div>
            </div>
        </article>
    );
};

export default ContextGraphPaper;
