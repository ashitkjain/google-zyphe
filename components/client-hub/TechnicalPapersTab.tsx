
import React, { useState } from 'react';

type PaperId = 'recommender_system' | 'context_graph';

interface TechnicalPapersTabProps {
    initialPaper?: PaperId;
}

const TechnicalPapersTab: React.FC<TechnicalPapersTabProps> = ({ initialPaper }) => {
    const [activePaper, setActivePaper] = useState<PaperId>(initialPaper || 'recommender_system');

    // Sync state if initialPaper changes
    React.useEffect(() => {
        if (initialPaper) setActivePaper(initialPaper);
    }, [initialPaper]);

    const papers = [
        { id: 'recommender_system', title: 'An Intelligent Context Aware Recommender System for Real Estate', date: 'Feb 2026', volume: 'Vol 01 / No. 04' },
        { id: 'context_graph', title: 'Vision & Proposal: The Zyphe "Context Graph"', date: 'Feb 2026', volume: 'Vol 01 / No. 05' },
    ];

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
            {activePaper === 'recommender_system' && <RecommenderPaper p={papers[0]} />}
            {activePaper === 'context_graph' && <ContextGraphPaper p={papers[1]} />}
        </div>
    );
};

const RecommenderPaper: React.FC<{ p: any }> = ({ p }) => (
    <article className="space-y-12 animate-in fade-in duration-500">
        <div className="space-y-6">
            <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                <span>{p.volume}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                <span>{p.date}</span>
            </div>
            <h2 className="text-4xl font-serif font-black text-slate-900 leading-tight max-w-4xl">
                {p.title}
            </h2>
        </div>

        <div className="border border-indigo-200 bg-indigo-50/30 rounded-3xl p-8 space-y-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Lift from context aware recommender system</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-serif font-black text-slate-900">59.9%</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Recall</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                        This represents the system's ability to find all relevant properties within the dataset.
                    </p>
                </div>
                <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-serif font-black text-slate-900">58.5%</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">User Coverage</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                        This indicates the percentage of users for which the system is able to provide recommendations.
                    </p>
                </div>
                <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-serif font-black text-slate-900">29.3%</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">MRR (Mean Reciprocal Rank)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                        A measure of ranking quality, indicating how high the relevant property appeared in the list.
                    </p>
                </div>
            </div>

            <div className="pt-8 border-t border-indigo-200/50">
                <div className="border border-slate-200/50 rounded-2xl overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-400 uppercase tracking-widest">
                            <tr>
                                <th className="p-4">Metric</th>
                                <th className="p-4 text-center">GRU Baseline</th>
                                <th className="p-4 text-center">Context aware</th>
                                <th className="p-4 text-center text-indigo-600">Lift (Difference)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                            {[
                                { m: "Recall", b: "54.3%", p: "59.9%", l: "+5.6%" },
                                { m: "User Coverage", b: "53.5%", p: "58.5%", l: "+5.0%" },
                                { m: "MRR (Mean Reciprocal Rank)", b: "25.1%", p: "29.3%", l: "+4.2%" },
                            ].map((row, i) => (
                                <tr key={i}>
                                    <td className="p-4 text-slate-900 uppercase tracking-widest font-black">{row.m}</td>
                                    <td className="p-4 text-center text-slate-400">{row.b}</td>
                                    <td className="p-4 text-center text-slate-900 underline underline-offset-4 decoration-slate-200">{row.p}</td>
                                    <td className="p-4 text-center text-indigo-600 bg-indigo-50/30">{row.l}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-8 space-y-10 text-[15px] leading-relaxed text-slate-700 font-medium">
                <section className="space-y-6">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Introduction</h3>
                    <div className="space-y-4">
                        <p>
                            This article summarizes the research paper - <a href="https://www.researchgate.net/publication/338017241_An_Intelligent_Context_Aware_Recommender_System_for_Real-Estate" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">An Intelligent Context Aware Recommender System for Real Estate</a> that demonstrates why real estate search needs to be contextual, using a deep learning model.
                        </p>
                        <ul className="space-y-3 list-disc pl-5 text-slate-600">
                            <li>Real estate purchase process is long and complex, not well suited for the most commonly used recommendation algorithms like content/collaborative filtering.</li>
                            <li>It is a complex multi-faceted decision process, searching through a huge list of choices that often causes user search fatigue.</li>
                            <li>Due to sparsity of data and other issues, user coverage of recommendations is low and cold start is a big problem</li>
                            <li>The recommender systems do not consider temporal nature and situational elements of the purchase process</li>
                            <li>They focus too much on the most recent "suburban house" and forget the initial interest in "condos."</li>
                            <li>They don’t account for the possibility that they user may be comparing different lifestyles</li>
                        </ul>
                    </div>
                </section>

                <section className="space-y-6">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Overview</h3>
                    <div className="space-y-4">
                        <p>Contextual factors significantly enhance real estate recommendation platforms.</p>
                        <ul className="space-y-4 list-none text-slate-600">
                            <li>
                                <strong className="text-slate-900 block mb-1">Contextual Integration:</strong>
                                Unlike rudimentary systems that base suggestions solely on historical user interactions, this advanced model incorporates both spatial (location-based) and temporal (time-based) dimensions.
                            </li>
                            <li>
                                <strong className="text-slate-900 block mb-1">GORU (Gated Orthogonal Recurrent Unit):</strong>
                                Standard Recurrent Neural Networks (RNNs) frequently experience the "vanishing gradient" problem, leading to the loss of information from earlier interactions. GORU addresses this by employing orthogonal matrices, effectively preserving information across longer sequences, a capability found to be more beneficial for the intricate, long-term nature of real estate searches.
                            </li>
                        </ul>
                        <p>The results of the paper demonstrate that the proposed GORU (Gated Orthogonal Recurrent Unit) framework significantly outperforms traditional models in the real-estate domain.</p>
                        <p>The researchers evaluated the system using three primary metrics: Recall, User Coverage, and Mean Reciprocal Rank (MRR).</p>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-slate-100 pt-10">
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">1. Key Performance Metrics</h4>
                        <ul className="space-y-4 text-xs italic text-slate-500 font-bold leading-relaxed">
                            <li><strong>Precision Rate:</strong> The system reached a 79% precision rate. In practical terms, this means that out of every 5 properties recommended, users were genuinely interested in at least 3.</li>
                            <li><strong>Recall & MRR:</strong> The GORU model showed higher accuracy in predicting the "next item" in a session compared to standard baselines like GRU4Rec or BPR (Bayesian Personalized Ranking).</li>
                            <li><strong>User Coverage:</strong> The system was able to provide relevant recommendations for a wider percentage of the user base, including those with very little historical data.</li>
                        </ul>
                    </section>
                    <section className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">2. Qualitative Findings</h4>
                        <ul className="space-y-4 text-xs text-slate-600 leading-relaxed">
                            <li><strong>Reduced Search Fatigue:</strong> Users found properties faster because the system filtered out geographically or financially irrelevant "noise" immediately.</li>
                            <li><strong>Temporal Sensitivity:</strong> The system successfully recognized that a user's intent on a Saturday morning (leisurely browsing) differs from a Tuesday evening (specific utility searching), leading to higher engagement.</li>
                            <li><strong>Impact on Decision Making:</strong> The authors concluded that by mimicking the "intuition" of a real estate agent (understanding location and budget context), the AI significantly supplements the decision-making process for both traders and home-buyers.</li>
                        </ul>
                    </section>
                </div>

                <section className="space-y-6 pt-10 border-t border-slate-100">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">The Multi-step hybrid pipeline</h3>
                    <p>The recommendation process is formally structured as a multi-step hybrid pipeline, integrating sequential deep learning with a similarity-based ranking mechanism.</p>
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Three-Step Process</h4>
                        <div className="space-y-8 pl-4 border-l-2 border-slate-900">
                            {[
                                { t: "Initial Shortlist (Sequence Modeling)", d: "The system uses a Gated Orthogonal Recurrent Unit (GORU) to analyze the sequence of a user's recent interactions. GORU manages long-session memory while prioritizing recent activity, outputting a preliminary list of probable successor properties." },
                                { t: "Contextual Re-Ranking (Refinement)", d: "This phase refines the initial list by integrating property attributes and dynamic contextual factors (e.g., user location, time). Weighted Cosine Similarity, assigning higher weights to critical attributes like location, is computed between the last interacted item and each candidate to re-rank the properties." },
                                { t: "Final Delivery", d: "The Top-N properties with the highest similarity scores are selected and presented as the final recommendations." }
                            ].map((s, i) => (
                                <div key={i} className="space-y-1">
                                    <p className="text-[13px] font-black text-slate-900 italic underline underline-offset-4 decoration-slate-200">{s.t}</p>
                                    <p className="text-[11px] text-slate-500 font-bold">{s.d}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="space-y-10 pt-16 border-t border-slate-200">
                    <h2 className="text-xl font-black text-slate-900">Conclusion</h2>
                    <p className="text-[15px] leading-relaxed text-slate-600 font-medium italic">
                        In conclusion, the researched context-aware recommender system, centered around the Gated Orthogonal Recurrent Unit (GORU) framework and a multi-step hybrid pipeline, successfully addresses the complexity and long-term nature of the real estate purchase process, which is poorly served by traditional recommendation methods. By systematically integrating sequential user interactions, static property attributes, and dynamic contextual data—such as GPS location and time—the system achieves a high precision rate (79%), superior accuracy compared to baselines like GRU4Rec and BPR, increased user coverage and faster searches reducing user fatigue. Ultimately, this intelligent AI framework mimics the intuition of a human real estate agent, effectively reducing user search fatigue and significantly supplementing the critical decision-making process for both traders and home-buyers.
                    </p>
                </section>
            </div>

            <div className="lg:col-span-4 space-y-12">
                <div className="bg-slate-50 p-8 rounded-sm border border-slate-200 space-y-8">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Three-Key Data types</h3>
                    <div className="space-y-6">
                        {[
                            { h: "User Interaction", p: "Captures real-time session data, including Clickstreams, Action Types, and Navigation Patterns." },
                            { h: "Property Attributes", p: "Fixed listing characteristics essential for Content-Based similarity." },
                            { h: "Contextual Data", p: "Identifies search \"when\" and \"where,\" including Spatial (GPS) and Temporal Context." }
                        ].map((d, i) => (
                            <div key={i} className="space-y-2">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{d.h}</h4>
                                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">{d.p}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Structure Overview</h3>
                    <div className="border border-slate-200 overflow-hidden rounded-sm">
                        <table className="w-full text-left text-[11px]">
                            <thead className="bg-slate-900 text-white font-black uppercase tracking-widest">
                                <tr>
                                    <th className="p-3">Category</th>
                                    <th className="p-3">Usage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                                <tr><td className="p-3">Sequential</td><td className="p-3">GORU Engine Input</td></tr>
                                <tr><td className="p-3">Content</td><td className="p-3">Similarity Weights</td></tr>
                                <tr><td className="p-3">Contextual</td><td className="p-3">Final Re-ranking</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </article>
);

const ContextGraphPaper: React.FC<{ p: any }> = ({ p }) => {
    return (
        <article className="space-y-12 animate-in fade-in duration-500">
            <div className="space-y-6">
                <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    <span>{p.volume}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    <span>{p.date}</span>
                </div>
                <h2 className="text-4xl font-serif font-black text-slate-900 leading-tight max-w-4xl">
                    {p.title}
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                <div className="lg:col-span-8 space-y-12 text-[15px] leading-relaxed text-slate-700 font-medium">
                    <section className="space-y-6">
                        <p>In the real estate sector, a Context Graph is the key to transforming a standard property search from a simple "filter-by-features" experience into a powerful "decision-support" engine. For a platform like Zyphe, applying this technology means the AI doesn't just find a 3-bedroom house; it understands the rationale and historical context behind every step of the real estate transaction.</p>
                        <p>This shift moves Zyphe from being a "System of Record" to a "System of Intent," that understands the why behind every real estate move, enabling realtors to transition from reactive coordinators to proactive advisors.</p>
                        <div className="bg-slate-50 p-8 border border-slate-200 rounded-sm italic text-slate-600">
                            <strong>Example:</strong> Zyphe will deploy Context Graphs as the central nervous system for real estate. Instead of realtors manually checking leads, the Zyphe Agent traverses the graph 24/7. When a property's Visual Context (newly renovated kitchen) matches a lead's Behavioral Context (was looking for a chef's kitchen) and the Macro Context (rates just dropped), Zyphe generates a proactive outreach for the agent to review and send.
                        </div>
                    </section>

                    <section className="space-y-8">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900">Decision Factors</h3>
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
                                    <h4 className="text-[13px] font-black text-slate-900 border-b border-slate-100 pb-2">{s.n}</h4>
                                    <p className="text-[13px] text-slate-500 font-bold mb-4">{s.d}</p>
                                    <ul className="space-y-3 list-none">
                                        {s.items.map((item, j) => (
                                            <li key={j} className="flex gap-4 text-[13px]">
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

                <div className="lg:col-span-4 space-y-12">
                    <div className="bg-slate-900 p-8 rounded-sm text-white space-y-8 shadow-xl">
                        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Context Summary</h4>
                        <div className="space-y-6">
                            {[
                                { t: "Environmental", d: "Is this home safe, quiet, and energy-efficient?" },
                                { t: "Visual", d: "How should I price this based on finishes and utility?" },
                                { t: "Macro", d: "Is market momentum right for this client?" },
                                { t: "Behavioral", d: "Does this match hidden life-stage preferences?" },
                                { t: "Operational", d: "Is this deal financially feasible and compliant?" }
                            ].map((row, i) => (
                                <div key={i} className="space-y-1 border-b border-white/5 pb-4 last:border-0">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{row.t}</span>
                                    <p className="text-[11px] text-slate-400 font-bold italic">{row.d}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Node Architecture</h4>
                        {[
                            { h: "Identity Nodes", d: "Stakeholders as containers for history and intent (Buyer, Seller, Agent)." },
                            { h: "Physical/Visual Nodes", d: "Derived from Visual Int. (Property, Material, Utility)." },
                            { h: "Environmental/Macro Nodes", d: "External Ground Truths (Acoustic, Risk, Market)." },
                            { h: "Logical/Intent Nodes", d: "Proprietary abstract concepts (Objection, Life Event)." }
                        ].map((n, i) => (
                            <div key={i} className="p-4 border border-slate-100 rounded-sm">
                                <span className="text-[10px] font-black text-slate-900 block">{n.h}</span>
                                <span className="text-[10px] text-slate-500 font-medium">{n.d}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Technical Logic Table - Full Width */}
                <div className="lg:col-span-12 py-12 border-t border-slate-100">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 mb-8">Technical Logic: Decision Traces</h3>
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
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-16 pb-16">
                    <section className="space-y-6">
                        <h3 className="text-xl font-black text-slate-900">How the Graph "Thinks" with Traces</h3>
                        <p className="text-[14px]">The Context Graph treats every decision as a directed edge. This creates a feedback loop where the factors continuously refine the traces.</p>
                        <ul className="space-y-4 text-[13px] border-l-2 border-slate-900 pl-6">
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
                                <h4 className="text-xs font-black uppercase tracking-widest leading-none">Multi-Hop Reasoning</h4>
                                <p className="text-[13px]">Allows Zyphe to "travel" through connections to find non-obvious answers (e.g., why Maria stopped looking due to specific highway construction news).</p>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xs font-black uppercase tracking-widest leading-none">Bitemporal Connectivity</h4>
                                <p className="text-[13px]">Maintains a "History of Truth." If a house price drops, the graph shows the Event Node (e.g., Interest Rate Hike) that caused the change.</p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Comparison Table */}
                <div className="lg:col-span-12 py-12 border-y border-slate-100">
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
                                    <tr key={i} className="font-bold">
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
                <div className="lg:col-span-12 pt-16 grid grid-cols-1 md:grid-cols-2 gap-16">
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
                                    <span className="text-[10px] font-black block text-slate-900">{stack.h}</span>
                                    <span className="text-[10px] text-slate-500">{stack.p}</span>
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

export default TechnicalPapersTab;
