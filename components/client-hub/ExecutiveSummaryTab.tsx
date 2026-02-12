import React from 'react';

interface ExecutiveSummaryTabProps {
    setActiveTab?: (tab: any) => void;
    onNavigate?: (view: any, path: string) => void;
}

const ExecutiveSummaryTab: React.FC<ExecutiveSummaryTabProps> = ({ setActiveTab, onNavigate }) => {
    const [featuredVideo, setFeaturedVideo] = React.useState<{ url: string, name: string, summary: string, timestamp: number } | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [showPlayer, setShowPlayer] = React.useState(false);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    React.useEffect(() => {
        const fetchFeaturedVideo = async () => {
            try {
                const { listAdminVideos } = await import('../../services/firebase/storage');
                const videos = await listAdminVideos();
                // Find specific video "Real Estate With AI" or use the latest one
                const video = videos.find(v => v.name.toLowerCase().includes('real_estate_with_ai')) || videos[0];
                if (video) setFeaturedVideo(video);
            } catch (error) {
                console.error("Failed to fetch featured video:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFeaturedVideo();
    }, []);

    const handleMaximize = () => {
        if (videoRef.current) {
            if (videoRef.current.requestFullscreen) {
                videoRef.current.requestFullscreen();
            } else if ((videoRef.current as any).webkitRequestFullscreen) {
                (videoRef.current as any).webkitRequestFullscreen();
            }
        }
    };

    return (
        <div className="p-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
            {/* Hero Section */}
            <section className="space-y-8">
                <div className="flex items-center gap-6 text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">
                    <span>Investor Confidential</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    <span>v2.0 / 2026</span>
                </div>
                <div className="space-y-4">
                    <h1 className="text-6xl font-serif font-black text-slate-900 leading-[1.1] tracking-tight max-w-5xl">
                        Zyphe: The AI-Powered <span className="text-indigo-600">Real Estate Operating System</span>
                    </h1>
                    <p className="text-xl text-slate-500 font-medium max-w-3xl leading-relaxed">
                        Unifying the fragmented property journey through multimodal intelligence and a unified platform to unlock a 110-180B$ opportunity (
                        <button
                            onClick={() => {
                                setActiveTab?.('industry_research');
                                onNavigate?.('industry_research', '/realtor/industry_research');
                            }}
                            className="text-indigo-600 font-bold hover:underline"
                        >
                            Industry Research
                        </button>
                        ).
                    </p>
                </div>
            </section>

            {/* Product Vision & Demo */}
            {!loading && featuredVideo && (
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
                    <div className="lg:col-span-7">
                        <div
                            onClick={() => setShowPlayer(true)}
                            className="group relative aspect-video bg-slate-900 rounded-[2.5rem] overflow-hidden cursor-pointer border border-slate-200 shadow-2xl"
                        >
                            <video
                                src={featuredVideo.url}
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
                        <div className="h-full p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                                <i className="fa-solid fa-bolt-lightning text-8xl text-indigo-400"></i>
                            </div>
                            <div className="space-y-6 relative">
                                <div className="flex gap-4 items-start">
                                    <i className="fa-solid fa-bolt-lightning text-2xl text-indigo-400 mt-1 flex-none"></i>
                                    <p className="text-lg leading-relaxed font-medium italic text-slate-200">
                                        "Zyphe is a next-generation AI native real estate platform that unifies the fragmented home-buying journey."
                                    </p>
                                </div>
                                <div className="space-y-4 pt-6 border-t border-white/10">
                                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                        By leveraging AI, Zyphe bridges the gap between property discovery for buyers and transaction management for realtors.
                                    </p>
                                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                        It transforms a standard property listing into a deep, actionable intelligence report while acting as a high-powered, automated CRM.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Combined Context Section */}
            <section className="space-y-24">
                {/* 1. The Problem */}
                <div className="space-y-8">
                    <h3 className="text-3xl font-serif font-black text-slate-900">The Problems</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 font-medium">
                        <div className="p-8 border border-slate-200 rounded-[2rem] bg-white hover:border-indigo-200 transition-colors group">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <i className="fa-solid fa-house-chimney-crack text-lg"></i>
                                </div>
                                <h4 className="text-lg font-black text-slate-900">For Buyers</h4>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Listings are static. "Analysing" a home means staring at photos and guessing about repairs, neighborhood vibes, or investment potential.
                            </p>
                        </div>
                        <div className="p-8 border border-slate-200 rounded-[2rem] bg-white hover:border-indigo-200 transition-colors group">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <i className="fa-solid fa-screwdriver-wrench text-lg"></i>
                                </div>
                                <h4 className="text-lg font-black text-slate-900">For Sellers</h4>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                The process of preparing a home for the market is opaque. Sellers lack tools to objectively assess listing quality or presentation.
                            </p>
                        </div>
                        <div className="p-8 border border-slate-200 rounded-[2rem] bg-white hover:border-indigo-200 transition-colors group">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <i className="fa-solid fa-network-wired text-lg"></i>
                                </div>
                                <h4 className="text-lg font-black text-slate-900">For Realtors</h4>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Workflow is scattered across legacy systems. Many agents are underserved by modern tech and lack the specialized skills required for leveraging AI.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 2. Pivotal Enablers Section */}
                <div className="space-y-12">
                    <div className="space-y-4">
                        <h3 className="text-3xl font-serif font-black text-slate-900 leading-snug">
                            Pivotal Enablers: <span className="text-indigo-600">Capitalizing on the AI & Data Convergence</span>
                        </h3>
                        <p className="text-slate-600 font-medium leading-relaxed max-w-4xl">
                            The real estate landscape has reached a technological inflection point. There is now a unique window to leverage these core enablers to disrupt the legacy status quo:
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Enabler 1 */}
                        <div className="p-8 border border-slate-200 rounded-[2.5rem] bg-white hover:border-indigo-200 transition-all group flex flex-col h-full shadow-sm hover:shadow-md">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-brain text-xl"></i>
                                </div>
                                <h4 className="text-xl font-black text-slate-900 leading-tight">Multi-Modal Intelligence</h4>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed mb-6">
                                There is a massive opportunity to deploy Multi-Modal GenAI that synthesizes visual, geospatial, and behavioral data to solve industry problems with human-level reasoning. These general purpose models don't require specialized ML engineering or staff to build advanced ML capabilities.
                            </p>
                            <div className="mt-auto space-y-4 pt-6 border-t border-slate-100">
                                <div className="space-y-1">
                                    <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">Contextual Discovery</h5>
                                    <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                                        There is an opportunity to integrate Visual and Geospatial AI to power recommendations that understand the "vibe" and surroundings of a property—not just its bed/bath count.
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">Predictive Intent</h5>
                                    <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                                        By leveraging deep reasoning, there is an opportunity to mine buyer intent and automate lead reactivation in ways that were technically impossible until now.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Enabler 2 */}
                        <div className="p-8 border border-slate-200 rounded-[2.5rem] bg-white hover:border-indigo-200 transition-all group flex flex-col h-full shadow-sm hover:shadow-md">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-gauge-high text-xl"></i>
                                </div>
                                <h4 className="text-xl font-black text-slate-900 leading-tight">20X Efficiency</h4>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed mb-6">
                                The traditional high cost of software R&D is no longer a barrier to entry. With AI-assisted coding, there is an opportunity to compress the development lifecycle by a factor of 20.
                            </p>
                            <div className="mt-auto space-y-4 pt-6 border-t border-slate-100">
                                <div className="space-y-1">
                                    <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">Velocity as a Strategy</h5>
                                    <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                                        This efficiency creates an opportunity to develop deep, seamless integrations and high-fidelity user experiences at a fraction of the traditional cost.
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">Market Democratization</h5>
                                    <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                                        Lower R&D overhead provides the opportunity to bring enterprise-grade technology to the broad market at a price point that drives immediate, friction-free adoption.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Enabler 3 */}
                        <div className="p-8 border border-slate-200 rounded-[2.5rem] bg-white hover:border-indigo-200 transition-all group flex flex-col h-full shadow-sm hover:shadow-md">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <i className="fa-solid fa-file-shield text-xl"></i>
                                </div>
                                <h4 className="text-xl font-black text-slate-900 leading-tight">Data & Regulatory Changes</h4>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed mb-6">
                                Recent shifts in data policy and API availability have removed the final moats protecting legacy incumbents.
                            </p>
                            <div className="mt-auto space-y-4 pt-6 border-t border-slate-100">
                                <div className="space-y-1">
                                    <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">MLS Transparency</h5>
                                    <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                                        Through Brokerage Back Office (BBO) rights, there is now an opportunity to utilize highly regulated MLS data—including property imagery—to build more comprehensive consumer tools.
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <h5 className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">360-Degree Context</h5>
                                    <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                                        There is an opportunity to aggregate low-cost, high-value data (Solar, Pollution, Crime, and Noise metrics) to provide a level of transparency that traditional platforms currently lack.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2.5 Zyphe's Strategy Section */}
                <div className="space-y-12">
                    <div className="space-y-6">
                        <h3 className="text-3xl font-serif font-black text-slate-900">Zyphe’s Strategy: Scaling Disruption</h3>
                        <p className="text-slate-600 font-medium leading-relaxed max-w-4xl">
                            While the real estate tech sector is beginning to address systemic inefficiencies through AI and data unification—as detailed in our{' '}
                            <button
                                onClick={() => {
                                    setActiveTab?.('industry_case_studies');
                                    onNavigate?.('industry_case_studies', '/realtor/industry_case_studies');
                                }}
                                className="text-indigo-600 font-bold hover:underline"
                            >
                                Industry Case Studies
                            </button>{' '}
                            —Zyphe is positioned to leapfrog the incumbent trajectory. We aren't just iterating; we are accelerating. By combining proprietary AI architecture with an aggressive cost-efficiency model, Zyphe delivers 20X the innovation velocity at a fraction of the traditional economic burn.
                        </p>
                    </div>

                    <div className="space-y-8">
                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-wider border-l-4 border-indigo-600 pl-4">The Competitive Edge</h4>
                        <p className="text-slate-500 font-medium">Our strategy focuses on capturing the "under-teched" mass market by removing the barriers of cost and complexity.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-8 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-200 transition-all group flex flex-col">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-none">
                                        <i className="fa-solid fa-chart-line text-lg"></i>
                                    </div>
                                    <h5 className="text-lg font-black text-slate-900 leading-tight">Alpha-Generating Innovation</h5>
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    We deploy high-impact features like Visual AI, Context Graphs, and GenAI-driven lead conversion and reactivation. These tools can transform high value applications from personalized and contextual search to post-closing engagement and reactivation.
                                </p>
                            </div>

                            <div className="p-8 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-200 transition-all group flex flex-col">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-none">
                                        <i className="fa-solid fa-plug-circle-check text-lg"></i>
                                    </div>
                                    <h5 className="text-lg font-black text-slate-900 leading-tight">Zero-Friction Integration</h5>
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    To drive immediate market penetration, our "plug and play" architecture eliminates the switching costs typically associated with new tech. We integrate into existing workflows without requiring process overhauls, ensuring rapid, scalable adoption.
                                </p>
                            </div>

                            <div className="p-8 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-200 transition-all group flex flex-col">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-none">
                                        <i className="fa-solid fa-gears text-lg"></i>
                                    </div>
                                    <h5 className="text-lg font-black text-slate-900 leading-tight">High-Margin Operational Efficiency</h5>
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Our "AI + Human" hybrid model utilizes AI-assisted coding to slash R&D timelines and offshore administrative staff to guarantee data accuracy. This allows us to offer premium, enterprise-grade solutions at a price point that unlocks the broader mid-market.
                                </p>
                            </div>

                            <div className="p-8 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-200 transition-all group flex flex-col">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-none">
                                        <i className="fa-solid fa-rocket text-lg"></i>
                                    </div>
                                    <h5 className="text-lg font-black text-slate-900 leading-tight">Organic Growth</h5>
                                </div>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    By delivering synchronized value to the entire real estate ecosystem—buyers, sellers, and agents—Zyphe generates the network effects necessary for compounded organic growth.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Industry Validation */}
                <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 flex flex-col lg:flex-row gap-12 items-start">
                    <div className="space-y-6 flex-1">
                        <div className="space-y-2">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Industry Validation</span>
                            <p className="text-xl font-serif font-black text-indigo-900 leading-snug">
                                NAR 2025: Realtors and clients view AI positively, but are frustrated by fragmented platforms and data silos ("The Swivel Chair" workflow).
                            </p>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-3 text-[12px] text-indigo-800/70 font-medium leading-relaxed">
                                <i className="fa-solid fa-circle-check mt-1 text-[10px] text-indigo-400"></i>
                                <span>Only 38% of respondents agree that their Brokerage provides them with all the technology tools they need to be successful.</span>
                            </li>
                            <li className="flex items-start gap-3 text-[12px] text-indigo-800/70 font-medium leading-relaxed">
                                <i className="fa-solid fa-circle-check mt-1 text-[10px] text-indigo-400"></i>
                                <span>MLS Satisfaction: Median score of 3/5 (Neutral/Content), signaling a significant gap in high-performing core technology.</span>
                            </li>
                            <li className="flex items-start gap-3 text-[12px] text-indigo-800/70 font-medium leading-relaxed">
                                <i className="fa-solid fa-circle-check mt-1 text-[10px] text-indigo-400"></i>
                                <span>Emerging Tech Gap: Only 8% of Realtors feel proficient enough to teach others, while 59% are "still learning" and 34% have little to no usage.</span>
                            </li>
                            <li className="flex items-start gap-3 text-[12px] text-indigo-800/70 font-medium leading-relaxed">
                                <i className="fa-solid fa-circle-check mt-1 text-[10px] text-indigo-400"></i>
                                <span>GenAI Adoption: While 41% of Realtors have begun utilizing Generative AI, a significant 30% currently utilize no emerging technology tools at all.</span>
                            </li>
                        </ul>
                    </div>
                    <div className="min-w-[280px] lg:border-l lg:border-indigo-200 lg:pl-12 space-y-8">
                        <div className="space-y-1">
                            <span className="text-4xl font-black text-indigo-600">$180B</span>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">McKinsey GenAI Value Add</p>
                        </div>
                        <div className="space-y-4">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI Adoption Curve</span>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/50 rounded-2xl border border-indigo-100/50">
                                    <div className="text-2xl font-black text-indigo-600">20%</div>
                                    <div className="text-[9px] font-black text-indigo-900/60 uppercase leading-none mt-1">Daily Usage<br />Velocity</div>
                                </div>
                                <div className="p-4 bg-white/50 rounded-2xl border border-indigo-100/50">
                                    <div className="text-2xl font-black text-indigo-400">32%</div>
                                    <div className="text-[9px] font-black text-indigo-900/40 uppercase leading-none mt-1">Untapped<br />Potential</div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Primary Motivators</span>
                            <div className="space-y-3">
                                {[
                                    { label: "Saving Time", val: 66 },
                                    { label: "Improving client experience", val: 64 },
                                    { label: "Closing more deals", val: 51 }
                                ].map((g, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="flex justify-between text-[10px] font-black text-indigo-900/60 uppercase">
                                            <span>{g.label}</span>
                                            <span>{g.val}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-indigo-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${g.val}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* The Zyphe Product Ecosystem */}
            <section className="space-y-16">
                <div className="space-y-4">
                    <h3 className="text-3xl font-serif font-black text-slate-900">The Zyphe Product Ecosystem</h3>
                    <p className="text-slate-500 font-medium">Built on a 3-pillar product foundation : Experience, Functionality, and Technology.</p>
                </div>

                <div className="space-y-12">
                    {/* Pillar 1: Experience */}
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                        <div className="absolute top-0 right-0 p-8 text-6xl font-black text-slate-50 group-hover:text-indigo-50 transition-colors">01</div>
                        <div className="space-y-2">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">Pillar 1: Experience</h4>
                            <h5 className="text-2xl font-serif font-black text-slate-900">Delightful, engaging and intuitive experiences that remove the "admin" tax</h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-2">
                                <div className="flex items-center gap-3">
                                    <i className="fa-solid fa-file-import text-indigo-500 flex-none text-sm"></i>
                                    <h6 className="font-black text-xs text-slate-900">Universal Ingest</h6>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Instantly sanitizes and maps legacy CSVs, PDFs, and CRM data.</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-2">
                                <div className="flex items-center gap-3">
                                    <i className="fa-solid fa-comment-dots text-indigo-500 flex-none text-sm"></i>
                                    <h6 className="font-black text-xs text-slate-900">Conversational Command</h6>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Natural language for platform action and agentic task execution via chatbot.</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-2">
                                <div className="flex items-center gap-3">
                                    <i className="fa-solid fa-book-open text-indigo-500 flex-none text-sm"></i>
                                    <h6 className="font-black text-xs text-slate-900">"Home Story" Portal</h6>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Intuitive "all-in-one" journey preventing manual data copy and entry.</p>
                            </div>
                        </div>
                    </div>

                    {/* Pillar 2: Functionality */}
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                        <div className="absolute top-0 right-0 p-8 text-6xl font-black text-slate-50 group-hover:text-indigo-50 transition-colors">02</div>
                        <div className="space-y-2">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">Pillar 2: Functionality</h4>
                            <h5 className="text-2xl font-serif font-black text-slate-900">A comprehensive suite of functionalities so users can find it all in one place</h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex gap-4 p-6 border border-slate-100 rounded-3xl bg-slate-50/50">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-none"><i className="fa-solid fa-box-archive"></i></div>
                                <div className="space-y-1">
                                    <h6 className="font-black text-xs text-slate-900">All-in-One + Modular</h6>
                                    <p className="text-[11px] text-slate-500 font-medium">Complete "business-in-a-box" (CRM, IDX, Closing) or "no-friction" plug-in for legacy stacks.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-6 border border-slate-100 rounded-3xl bg-slate-50/50">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-none"><i className="fa-solid fa-vr-cardboard"></i></div>
                                <div className="space-y-1">
                                    <h6 className="font-black text-xs text-slate-900">Vision & Spatial AI</h6>
                                    <p className="text-[11px] text-slate-500 font-medium">Analyzes listing photos and maps for condition, geo-spatial intelligence, and neighborhood data.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-6 border border-slate-100 rounded-3xl bg-slate-50/50">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-none"><i className="fa-solid fa-hand-holding-heart"></i></div>
                                <div className="space-y-1">
                                    <h6 className="font-black text-xs text-slate-900">Post-Closing Engagement</h6>
                                    <p className="text-[11px] text-slate-500 font-medium">Transforms transaction data into Automated Maintenance Roadmaps and ROI trackers.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-6 border border-slate-100 rounded-3xl bg-slate-50/50">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-none"><i className="fa-solid fa-seedling"></i></div>
                                <div className="space-y-1">
                                    <h6 className="font-black text-xs text-slate-900">Reactivation Engine</h6>
                                    <p className="text-[11px] text-slate-500 font-medium">Agentic AI that proactively mines dormant databases to revive cold leads using market triggers.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-6 border border-slate-100 rounded-3xl bg-slate-50/50">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-none"><i className="fa-solid fa-screwdriver-wrench"></i></div>
                                <div className="space-y-1">
                                    <h6 className="font-black text-xs text-slate-900">Comprehensive Realtor Tools</h6>
                                    <p className="text-[11px] text-slate-500 font-medium">Calendar, tasks, scratchpads, calculators, NL and audio interfaces all in one workflow.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-6 border border-slate-100 rounded-3xl bg-slate-50/50">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-none"><i className="fa-solid fa-tower-broadcast"></i></div>
                                <div className="space-y-1">
                                    <h6 className="font-black text-xs text-slate-900">Communication Hub</h6>
                                    <p className="text-[11px] text-slate-500 font-medium">Direct phonic, SMS, and email capabilities integrated into the CRM and Transaction layers.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pillar 3: Technology */}
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                        <div className="absolute top-0 right-0 p-8 text-6xl font-black text-slate-50 group-hover:text-indigo-50 transition-colors">03</div>
                        <div className="space-y-2">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-600">Pillar 3: Technology</h4>
                            <h5 className="text-2xl font-serif font-black text-slate-900">Modern tech stack based on secure and reliable Google Technologies, Context Graphs, Deep Integrations</h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <h6 className="font-black text-xs text-slate-900">Reasoning Web (Context Graph)</h6>
                                <p className="text-[11px] text-slate-500 font-medium">Architecture unifying visual, geospatial, and behavioral data into one source.</p>
                            </div>
                            <div className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <h6 className="font-black text-xs text-slate-900">20x Dev Velocity</h6>
                                <p className="text-[11px] text-slate-500 font-medium">Leveraging advanced code assistants and cloud-native infra for ultra-low-cost deployment.</p>
                            </div>
                            <div className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <h6 className="font-black text-xs text-slate-900">Grounded LLMs</h6>
                                <p className="text-[11px] text-slate-500 font-medium">Advanced models with real-time search grounding for live market data accuracy.</p>
                            </div>
                            <div className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <h6 className="font-black text-xs text-slate-900">Vision-to-Data Mapping</h6>
                                <p className="text-[11px] text-slate-500 font-medium">Proprietary models converting raw pixels into searchable property features and quality levels.</p>
                            </div>
                            <div className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                <h6 className="font-black text-xs text-slate-900">Hybrid Integration Layer</h6>
                                <p className="text-[11px] text-slate-500 font-medium">High-speed API infrastructure for instant "plug-and-play" with legacy estate software.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer / Contact */}
            <section className="text-center pt-8 border-t border-slate-100 italic text-slate-400 font-medium text-sm">
                "Not just a database. An ecosystem of intelligence."
            </section>

            {/* Video Player Modal */}
            {showPlayer && featuredVideo && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
                    <div
                        className="absolute inset-0 bg-slate-950/95 backdrop-blur-md"
                        onClick={() => setShowPlayer(false)}
                    />
                    <div className="relative w-full max-w-6xl aspect-video bg-black rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300">
                        <video
                            ref={videoRef}
                            src={featuredVideo.url}
                            controls
                            autoPlay
                            className="w-full h-full object-contain"
                        />
                        <div className="absolute top-6 right-6 flex gap-3">
                            <button
                                onClick={handleMaximize}
                                className="w-12 h-12 rounded-full bg-white/10 hover:bg-indigo-600 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all transform hover:scale-110"
                                title="Maximize to Fullscreen"
                            >
                                <i className="fa-solid fa-expand text-lg"></i>
                            </button>
                            <button
                                onClick={() => setShowPlayer(false)}
                                className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-black shadow-xl transition-all hover:rotate-90 hover:bg-slate-100"
                                title="Close Player"
                            >
                                <i className="fa-solid fa-times text-lg"></i>
                            </button>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 p-8 pt-24 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
                            <h3 className="text-2xl font-black text-white tracking-tight">
                                {featuredVideo.name.split('_').slice(1).join(' ').replace(/\.[^/.]+$/, "") || featuredVideo.name}
                            </h3>
                            <p className="text-slate-400 text-sm mt-2 max-w-3xl line-clamp-2 font-medium">
                                {featuredVideo.summary}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExecutiveSummaryTab;
