
import React from 'react';

const TechnicalPapersTab: React.FC = () => {
    return (
        <div className="p-12 max-w-5xl mx-auto space-y-16 animate-in fade-in duration-700 pb-32">
            {/* White Paper Header */}
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-10">
                <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span>Research Paper</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span>February 2026</span>
                </div>
                <h1 className="text-4xl font-serif font-black text-slate-900 tracking-tight leading-tight">
                    An Intelligent Context Aware Recommender System for Real Estate
                </h1>
            </div>

            <article className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                <div className="lg:col-span-8 space-y-12">
                    {/* Introduction */}
                    <section className="space-y-6">
                        <h2 className="text-xl font-black text-slate-900">Introduction</h2>
                        <div className="space-y-4 text-[15px] leading-relaxed text-slate-600 font-medium">
                            <p>
                                This paper highlights issues with current real estate recommender systems, and presents a research paper to support the case of using context aware recommender system:
                            </p>
                            <ul className="space-y-4 list-none">
                                {[
                                    "Real estate purchase process is long and complex, not well suited for the most commonly used recommendation algorithms like content/collaborative filtering.",
                                    "It is a complex multi-faceted decision process, searching through a huge list of choices that often causes user search fatigue.",
                                    "Due to sparsity of data and other issues, user coverage of recommendations is low and cold start is a big problem.",
                                    "The recommender systems do not consider temporal nature and situational elements of the purchase process.",
                                    "They focus too much on the most recent \"suburban house\" and forget the initial interest in \"condos.\"",
                                    "They don’t account for the possibility that they user may be comparing different lifestyles."
                                ].map((bullet, i) => (
                                    <li key={i} className="flex gap-4">
                                        <span className="text-slate-300 font-black">•</span>
                                        <span>{bullet}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    {/* Overview */}
                    <section className="space-y-6">
                        <h2 className="text-xl font-black text-slate-900">Overview</h2>
                        <div className="space-y-6 text-[15px] leading-relaxed text-slate-600 font-medium">
                            <p>Contextual factors significantly enhance real estate recommendation platforms.</p>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Contextual Integration</h3>
                                    <p>Unlike rudimentary systems that base suggestions solely on historical user interactions, this advanced model incorporates both spatial (location-based) and temporal (time-based) dimensions.</p>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">GORU (Gated Orthogonal Recurrent Unit)</h3>
                                    <p>Standard Recurrent Neural Networks (RNNs) frequently experience the "vanishing gradient" problem, leading to the loss of information from earlier interactions. GORU addresses this by employing orthogonal matrices, effectively preserving information across longer sequences, a capability found to be more beneficial for the intricate, long-term nature of real estate searches.</p>
                                </div>
                            </div>
                            <p>
                                The results of the paper demonstrate that the proposed GORU (Gated Orthogonal Recurrent Unit) framework significantly outperforms traditional models in the real-estate domain.
                                The researchers evaluated the system using three primary metrics: Recall, User Coverage, and Mean Reciprocal Rank (MRR).
                            </p>
                        </div>
                    </section>

                    {/* Performance & Qualitative */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
                        <section className="space-y-4">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">1. Key Performance Metrics</h2>
                            <div className="space-y-4 text-[13px] text-slate-600 font-medium leading-relaxed italic">
                                <p>The paper reports that the intelligent context-aware system achieved the following:</p>
                                <ul className="space-y-3">
                                    <li><strong>Precision Rate:</strong> The system reached a 79% precision rate. In practical terms, this means that out of every 5 properties recommended, users were genuinely interested in at least 3.</li>
                                    <li><strong>Recall & MRR:</strong> The GORU model showed higher accuracy in predicting the "next item" in a session compared to standard baselines like GRU4Rec or BPR (Bayesian Personalized Ranking).</li>
                                    <li><strong>User Coverage:</strong> The system was able to provide relevant recommendations for a wider percentage of the user base, including those with very little historical data.</li>
                                </ul>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">2. Qualitative Findings</h2>
                            <ul className="space-y-4 text-[13px] text-slate-600 font-medium leading-relaxed">
                                <li><strong>Reduced Search Fatigue:</strong> Users found properties faster because the system filtered out geographically or financially irrelevant "noise" immediately.</li>
                                <li><strong>Temporal Sensitivity:</strong> The system successfully recognized that a user's intent on a Saturday morning (leisurely browsing) differs from a Tuesday evening (specific utility searching), leading to higher engagement.</li>
                                <li><strong>Impact on Decision Making:</strong> The authors concluded that by mimicking the "intuition" of a real estate agent (understanding location and budget context), the AI significantly supplements the decision-making process for both traders and home-buyers.</li>
                            </ul>
                        </section>
                    </div>

                    {/* Pipeline */}
                    <section className="space-y-8 pt-12">
                        <h2 className="text-xl font-black text-slate-900">The Multi-step Hybrid Pipeline</h2>
                        <p className="text-[15px] leading-relaxed text-slate-600 font-medium">
                            The recommendation process is formally structured as a multi-step hybrid pipeline, integrating sequential deep learning with a similarity-based ranking mechanism.
                        </p>
                        <div className="space-y-8">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-l-4 border-slate-900 pl-4">Three-Step Process</h3>
                            {[
                                { title: "Initial Shortlist (Sequence Modeling)", desc: "The system uses a Gated Orthogonal Recurrent Unit (GORU) to analyze the sequence of a user's recent interactions. GORU manages long-session memory while prioritizing recent activity, outputting a preliminary list of probable successor properties." },
                                { title: "Contextual Re-Ranking (Refinement)", desc: "This phase refines the initial list by integrating property attributes and dynamic contextual factors (e.g., user location, time). Weighted Cosine Similarity, assigning higher weights to critical attributes like location, is computed between the last interacted item and each candidate to re-rank the properties." },
                                { title: "Final Delivery", desc: "The Top-N properties with the highest similarity scores are selected and presented as the final recommendations." }
                            ].map((step, i) => (
                                <div key={i} className="space-y-1">
                                    <h4 className="text-[14px] font-black text-slate-900 italic">{step.title}</h4>
                                    <p className="text-[14px] text-slate-500 font-medium leading-relaxed">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Sidebar Data */}
                <div className="lg:col-span-4 space-y-12">
                    <div className="bg-slate-50 p-8 rounded-sm border border-slate-200 space-y-8">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Architecture</h3>
                        <div className="space-y-6">
                            <section className="space-y-2">
                                <h4 className="text-xs font-black text-slate-900 uppercase">User Interaction</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">Captures real-time session data, including Clickstreams, Action Types, and Navigation Patterns.</p>
                            </section>
                            <section className="space-y-2">
                                <h4 className="text-xs font-black text-slate-900 uppercase">Property Attributes</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">Fixed listing characteristics such as Financials (price/rent) and Physical Specifications.</p>
                            </section>
                            <section className="space-y-2">
                                <h4 className="text-xs font-black text-slate-900 uppercase">Contextual Data</h4>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold underline decoration-slate-200 underline-offset-4">Identifies search "when" and "where," including Spatial (GPS) and Temporal context.</p>
                            </section>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Structure Overview</h3>
                        <div className="border border-slate-200 overflow-hidden rounded-sm">
                            <table className="w-full text-left text-[11px]">
                                <thead className="bg-slate-900 text-white font-black uppercase tracking-widest">
                                    <tr>
                                        <th className="p-3">Category</th>
                                        <th className="p-3">Examples</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                                    <tr>
                                        <td className="p-3 font-black text-slate-900">Sequential</td>
                                        <td className="p-3 italic">Clicks, session history</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 font-black text-slate-900">Content</td>
                                        <td className="p-3 italic">Price, size, rooms</td>
                                    </tr>
                                    <tr>
                                        <td className="p-3 font-black text-slate-900">Contextual</td>
                                        <td className="p-3 italic">GPS, time, date</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Conclusion */}
                <div className="lg:col-span-12 pt-16 border-t border-slate-200">
                    <section className="max-w-4xl space-y-6">
                        <h2 className="text-xl font-black text-slate-900">Conclusion</h2>
                        <p className="text-[15px] leading-relaxed text-slate-600 font-medium">
                            In conclusion, the researched context-aware recommender system, centered around the Gated Orthogonal Recurrent Unit (GORU) framework and a multi-step hybrid pipeline, successfully addresses the complexity and long-term nature of the real estate purchase process, which is poorly served by traditional recommendation methods. By systematically integrating sequential user interactions, static property attributes, and dynamic contextual data—such as GPS location and time—the system achieves a high precision rate (79%), superior accuracy compared to baselines like GRU4Rec and BPR, increased user coverage and faster searches reducing user fatigue. Ultimately, this intelligent AI framework mimics the intuition of a human real estate agent, effectively reducing user search fatigue and significantly supplementing the critical decision-making process for both traders and home-buyers.
                        </p>
                    </section>
                </div>
            </article>
        </div>
    );
};

export default TechnicalPapersTab;
