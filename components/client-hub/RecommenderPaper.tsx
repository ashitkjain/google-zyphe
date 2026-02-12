import React from 'react';

interface RecommenderPaperProps {
    p: {
        volume: string;
        date: string;
        title: string;
    };
}

const RecommenderPaper: React.FC<RecommenderPaperProps> = ({ p }) => (
    <article className="space-y-12 animate-in fade-in duration-500">
        <div className="space-y-6">

            <h2 className="text-4xl font-serif font-black text-slate-900 leading-tight max-w-4xl">
                {p.title}
            </h2>
        </div>

        <div className="border border-indigo-200 bg-indigo-50/30 rounded-3xl p-8 space-y-6">
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

            <div className="">
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
            <div className="lg:col-span-12 space-y-10 text-[17px] leading-relaxed text-slate-700 font-medium">
                <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">Introduction</h3>
                    <div className="space-y-4">
                        <p>
                            This article summarizes the research paper - <a href="https://www.researchgate.net/publication/338017241_An_Intelligent_Context_Aware_Recommender_System_for_Real-Estate" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">An Intelligent Context Aware Recommender System for Real Estate</a> that demonstrates why real estate search needs to be contextual, using a deep learning model.
                        </p>
                        <ul className="space-y-3 list-disc pl-5 text-slate-600">
                            <li>Real estate purchase process is long and complex, not well suited for the most commonly used recommendation algorithms like content/collaborative filtering.</li>
                            <li>It is a complex multi-faceted decision process, searching through a huge list of choices that often causes user search fatigue.</li>
                            <li>Due to sparsity of data and other issues, user coverage of recommendations is low and cold start is a big problem</li>
                            <li>The recommender systems do not consider temporal nature and situational elements of the purchase process. Example : They focus too much on the most recent "suburban house" and forget the initial interest in "condos." or they may not account for the possibility that they user may be comparing different lifestyles</li>
                        </ul>
                    </div>
                </section>

                <section className="space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">Overview</h3>
                    <div className="space-y-4">
                        <p>Contextual factors significantly enhance real estate recommendation platforms.</p>
                        <ul className="space-y-4 list-none text-slate-600">
                            <li>
                                <strong className="text-slate-900 block mb-1">Contextual Integration:</strong>
                                Unlike rudimentary systems that base suggestions solely on historical user interactions, this advanced model incorporates both spatial (location-based) and temporal (time-based) dimensions.
                            </li>
                            <li>
                                <strong className="text-slate-900 block mb-1">GORU (Gated Orthogonal Recurrent Unit):</strong>
                                Standard Recurrent Neural Networks (RNNs) frequently experience the "vanishing gradient" problem, leading to the loss of information from earlier interactions. GORU maintains context by employing orthogonal matrices, effectively preserving information across longer sequences.
                            </li>
                        </ul>
                        <p>The results of the paper demonstrate that the GORU framework (context aware recommendation system) significantly outperforms traditional models in the real-estate domain, in both quantitative and qualitative metrics (like searcher fatigue).</p>
                        <p>The researchers evaluated the system using three primary metrics: Recall, User Coverage, and Mean Reciprocal Rank (MRR).</p>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-slate-100 pt-10">
                    <section className="space-y-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">1. Key Performance Metrics</h4>
                        <ul className="space-y-4 text-[15px] text-slate-600 leading-relaxed">
                            <li><strong>Precision Rate:</strong> The system reached a 79% precision rate. In practical terms, this means that out of every 5 properties recommended, users were genuinely interested in at least 3.</li>
                            <li><strong>Recall & MRR:</strong> The GORU model showed higher accuracy in predicting the "next item" in a session compared to standard baselines like GRU4Rec or BPR (Bayesian Personalized Ranking).</li>
                            <li><strong>User Coverage:</strong> The system was able to provide relevant recommendations for a wider percentage of the user base, including those with very little historical data.</li>
                        </ul>
                    </section>
                    <section className="space-y-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">2. Qualitative Findings</h4>
                        <ul className="space-y-4 text-[15px] text-slate-600 leading-relaxed">
                            <li><strong>Reduced Search Fatigue:</strong> Users found properties faster because the system filtered out geographically or financially irrelevant "noise" immediately.</li>
                            <li><strong>Temporal Sensitivity:</strong> The system successfully recognized that a user's intent on a Saturday morning (leisurely browsing) differs from a Tuesday evening (specific utility searching), leading to higher engagement.</li>
                            <li><strong>Impact on Decision Making:</strong> The authors concluded that by mimicking the "intuition" of a real estate agent (understanding location and budget context), the AI significantly supplements the decision-making process for both traders and home-buyers.</li>
                        </ul>
                    </section>
                </div>

                <section className="space-y-6 pt-10 border-t border-slate-100">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">The Multi-step hybrid pipeline</h3>
                    <p>The recommendation process is formally structured as a multi-step hybrid pipeline, integrating sequential deep learning with a similarity-based ranking mechanism.</p>
                    <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Three-Step Process</h4>
                        <div className="space-y-8 pl-4 border-l-2 border-slate-900">
                            {[
                                { t: "Initial Shortlist (Sequence Modeling)", d: "The system uses a Gated Orthogonal Recurrent Unit (GORU) to analyze the sequence of a user's recent interactions. GORU manages long-session memory while prioritizing recent activity, outputting a preliminary list of probable successor properties." },
                                { t: "Contextual Re-Ranking (Refinement)", d: "This phase refines the initial list by integrating property attributes and dynamic contextual factors (e.g., user location, time). Weighted Cosine Similarity, assigning higher weights to critical attributes like location, is computed between the last interacted item and each candidate to re-rank the properties." },
                                { t: "Final Delivery", d: "The Top-N properties with the highest similarity scores are selected and presented as the final recommendations." }
                            ].map((s, i) => (
                                <div key={i} className="space-y-1">
                                    <p className="text-[16px] font-black text-slate-900 italic underline underline-offset-4 decoration-slate-200">{s.t}</p>
                                    <p className="text-[15px] text-slate-500 font-bold">{s.d}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="space-y-6 pt-10 border-t border-slate-200">
                    <h2 className="text-xl font-black text-slate-900">Conclusion</h2>
                    <p className="text-[17px] leading-relaxed text-slate-600 font-medium italic">
                        In conclusion, the researched context-aware recommender system, centered around the Gated Orthogonal Recurrent Unit (GORU) framework and a multi-step hybrid pipeline, successfully addresses the complexity and long-term nature of the real estate purchase process, which is poorly served by traditional recommendation methods. By systematically integrating sequential user interactions, static property attributes, and dynamic contextual data—such as GPS location and time—the system achieves a high precision rate (79%), superior accuracy compared to baselines like GRU4Rec and BPR, increased user coverage and faster searches reducing user fatigue. Ultimately, this intelligent AI framework mimics the intuition of a human real estate agent, effectively reducing user search fatigue and significantly supplementing the critical decision-making process for both traders and home-buyers.
                    </p>
                </section>
            </div>
        </div>
    </article>
);

export default RecommenderPaper;
