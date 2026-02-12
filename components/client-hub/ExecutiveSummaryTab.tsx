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
        <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
            {/* Hero Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-6 text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">
                    <span>Investor Confidential</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    <span>v2.0 / 2026</span>
                </div>
                <div className="space-y-2">
                    <h1 className="text-6xl font-serif font-black text-slate-900 leading-[1.1] tracking-tight">
                        Zyphe: The AI-Powered <span className="text-indigo-600">Real Estate Operating System</span>
                    </h1>
                    <p className="text-xl text-slate-500 font-medium leading-[1.6]">
                        Unifying the fragmented property journey through multimodal intelligence and a unified platform to unlock a $110B–$180B opportunity (
                        <button
                            onClick={() => {
                                setActiveTab?.('industry_research');
                                onNavigate?.('industry_research', '/realtor/industry_research');
                            }}
                            className="text-indigo-600 font-black hover:underline underline-offset-4"
                        >
                            Industry Research
                        </button>
                        ).
                    </p>
                </div>
            </section>

            {/* Product Vision & Demo */}
            {!loading && featuredVideo && (
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
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
                        <div className="h-full p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl flex flex-col justify-between relative overflow-hidden group">
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
            <section className="space-y-16">
                {/* 1. The Problem */}
                <div className="space-y-6">
                    <h3 className="text-3xl font-serif font-black text-slate-900">The Problems</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-medium">
                        <div className="p-6 border border-slate-200 rounded-[2rem] bg-white hover:border-indigo-200 transition-colors group">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <i className="fa-solid fa-house-chimney-crack text-lg"></i>
                                </div>
                                <h4 className="text-lg font-black text-slate-900">For Buyers</h4>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Listings are static. "Analysing" a home means staring at photos and guessing about repairs, neighborhood vibes, or investment potential.
                            </p>
                        </div>
                        <div className="p-6 border border-slate-200 rounded-[2rem] bg-white hover:border-indigo-200 transition-colors group">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                    <i className="fa-solid fa-screwdriver-wrench text-lg"></i>
                                </div>
                                <h4 className="text-lg font-black text-slate-900">For Sellers</h4>
                            </div>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                The process of preparing a home for the market is opaque. Sellers lack tools to objectively assess listing quality or presentation.
                            </p>
                        </div>
                        <div className="p-6 border border-slate-200 rounded-[2rem] bg-white hover:border-indigo-200 transition-colors group">
                            <div className="flex items-center gap-4 mb-3">
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
                <div className="space-y-8">
                    <div className="space-y-2">
                        <h3 className="text-3xl font-serif font-black text-slate-900 leading-snug">
                            Pivotal Enablers: <span className="text-indigo-600">Capitalizing on the AI & Data Convergence</span>
                        </h3>
                        <p className="text-slate-600 font-medium leading-relaxed">
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
                                <h4 className="text-2xl font-black text-slate-900 leading-tight">Multi-Modal Intelligence</h4>
                            </div>
                            <p className="text-base text-slate-500 leading-relaxed mb-6">
                                There is a massive opportunity to deploy Multi-Modal GenAI that synthesizes visual, geospatial, and behavioral data to solve industry problems with human-level reasoning. These general purpose models don't require specialized ML engineering or staff to build advanced ML capabilities.
                            </p>
                            <div className="mt-auto space-y-5 pt-6 border-t border-slate-100">
                                <div className="space-y-1.5">
                                    <h5 className="text-[12px] font-black text-indigo-600 uppercase tracking-wider">Contextual Discovery</h5>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                        There is an opportunity to integrate Visual and Geospatial AI to power recommendations that understand the "vibe" and surroundings of a property—not just its bed/bath count.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <h5 className="text-[12px] font-black text-indigo-600 uppercase tracking-wider">Predictive Intent</h5>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
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
                                <h4 className="text-2xl font-black text-slate-900 leading-tight">20X Efficiency</h4>
                            </div>
                            <p className="text-base text-slate-500 leading-relaxed mb-6">
                                The traditional high cost of software R&D is no longer a barrier to entry. With AI-assisted coding, there is an opportunity to compress the development lifecycle by a factor of 20.
                            </p>
                            <div className="mt-auto space-y-5 pt-6 border-t border-slate-100">
                                <div className="space-y-1.5">
                                    <h5 className="text-[12px] font-black text-indigo-600 uppercase tracking-wider">Velocity as a Strategy</h5>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                        This efficiency creates an opportunity to develop deep, seamless integrations and high-fidelity user experiences at a fraction of the traditional cost.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <h5 className="text-[12px] font-black text-indigo-600 uppercase tracking-wider">Market Democratization</h5>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
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
                                <h4 className="text-2xl font-black text-slate-900 leading-tight">Data & Regulatory Changes</h4>
                            </div>
                            <p className="text-base text-slate-500 leading-relaxed mb-6">
                                Recent shifts in data policy and API availability have removed the final moats protecting legacy incumbents.
                            </p>
                            <div className="mt-auto space-y-5 pt-6 border-t border-slate-100">
                                <div className="space-y-1.5">
                                    <h5 className="text-[12px] font-black text-indigo-600 uppercase tracking-wider">MLS Transparency</h5>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                        Through Brokerage Back Office (BBO) rights, there is now an opportunity to utilize highly regulated MLS data—including property imagery—to build more comprehensive consumer tools.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <h5 className="text-[12px] font-black text-indigo-600 uppercase tracking-wider">360-Degree Context</h5>
                                    <p className="text-sm text-slate-600 font-medium leading-relaxed">
                                        There is an opportunity to aggregate low-cost, high-value data (Solar, Pollution, Crime, and Noise metrics) to provide a level of transparency that traditional platforms currently lack.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2.5 Zyphe's Strategy Section */}
                <div className="space-y-8">
                    <div className="space-y-3">
                        <h3 className="text-3xl font-serif font-black text-slate-900">Zyphe’s Strategy: Scaling Disruption</h3>
                        <p className="text-xl text-slate-600 font-medium leading-relaxed">
                            While the real estate tech sector is beginning to address systemic inefficiencies through AI and data unification, achieving demonstrated success—as detailed in our{' '}
                            <button
                                onClick={() => {
                                    setActiveTab?.('industry_case_studies');
                                    onNavigate?.('industry_case_studies', '/realtor/industry_case_studies');
                                }}
                                className="text-indigo-600 font-black hover:underline underline-offset-4"
                            >
                                Industry Case Studies
                            </button>{' '}
                            —Zyphe is positioned to leapfrog the incumbent trajectory. We aren't just iterating; we are accelerating. By combining proprietary AI architecture with an aggressive cost-efficiency model, Zyphe delivers 20X the innovation velocity at a fraction of the traditional economic burn.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-xl font-black text-slate-900 uppercase tracking-wider border-l-4 border-indigo-600 pl-4">The Competitive Edge</h4>
                        <p className="text-slate-500 font-medium">Our strategy focuses on capturing the "under-teched" mass market by removing the barriers of cost and complexity.</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-7 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-200 transition-all group flex flex-col shadow-sm">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-none">
                                        <i className="fa-solid fa-chart-line text-xl"></i>
                                    </div>
                                    <h5 className="text-xl font-black text-slate-900 leading-tight">Alpha-Generating Innovation</h5>
                                </div>
                                <p className="text-base text-slate-500 leading-relaxed font-medium">
                                    We deploy high-impact features like Visual AI, Context Graphs, and GenAI-driven lead conversion and reactivation. These tools can transform high value applications from personalized and contextual search to post-closing engagement and reactivation.
                                </p>
                            </div>

                            <div className="p-7 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-200 transition-all group flex flex-col shadow-sm">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-none">
                                        <i className="fa-solid fa-plug-circle-check text-xl"></i>
                                    </div>
                                    <h5 className="text-xl font-black text-slate-900 leading-tight">Zero-Friction Integration</h5>
                                </div>
                                <p className="text-base text-slate-500 leading-relaxed font-medium">
                                    To drive immediate market penetration, our "plug and play" architecture eliminates the switching costs typically associated with new tech. We integrate into existing workflows without requiring process overhauls, ensuring rapid, scalable adoption.
                                </p>
                            </div>

                            <div className="p-7 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-200 transition-all group flex flex-col shadow-sm">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-none">
                                        <i className="fa-solid fa-gears text-xl"></i>
                                    </div>
                                    <h5 className="text-xl font-black text-slate-900 leading-tight">High-Margin Operational Efficiency</h5>
                                </div>
                                <p className="text-base text-slate-500 leading-relaxed font-medium">
                                    Our "AI + Human" hybrid model utilizes AI-assisted coding to slash R&D timelines and offshore administrative staff to guarantee data accuracy. This allows us to offer premium, enterprise-grade solutions at a price point that unlocks the broader mid-market (
                                    <button
                                        onClick={() => {
                                            setActiveTab?.('unit_economics');
                                            onNavigate?.('unit_economics', '/realtor/unit_economics');
                                        }}
                                        className="text-indigo-600 font-bold hover:underline underline-offset-4"
                                    >
                                        Unit Economics
                                    </button>
                                    ).
                                </p>
                            </div>

                            <div className="p-7 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-200 transition-all group flex flex-col shadow-sm">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-none">
                                        <i className="fa-solid fa-rocket text-xl"></i>
                                    </div>
                                    <h5 className="text-xl font-black text-slate-900 leading-tight">Organic Growth</h5>
                                </div>
                                <p className="text-base text-slate-500 leading-relaxed font-medium">
                                    By delivering synchronized value to the entire real estate ecosystem—buyers, sellers, and agents—Zyphe generates the network effects necessary for compounded organic growth.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Industry Validation */}
                <div className="bg-indigo-50 p-6 rounded-[2.5rem] border border-indigo-100 flex flex-col lg:flex-row gap-8 items-start">
                    <div className="space-y-8 flex-1">
                        <div className="space-y-4">
                            <span className="text-xs font-black text-indigo-600 uppercase tracking-[0.3em]">Industry Validation</span>
                            <p className="text-3xl font-serif font-black text-indigo-900 leading-tight">
                                NAR 2025: Realtors and clients view AI positively, but are frustrated by fragmented platforms and data silos ("The Swivel Chair" workflow).
                            </p>
                        </div>
                        <ul className="space-y-6">
                            <li className="flex items-start gap-4 text-base text-indigo-800/80 font-medium leading-relaxed">
                                <i className="fa-solid fa-circle-check mt-1.5 text-sm text-indigo-400"></i>
                                <span>Only 38% of respondents agree that their Brokerage provides them with all the technology tools they need to be successful.</span>
                            </li>
                            <li className="flex items-start gap-4 text-base text-indigo-800/80 font-medium leading-relaxed">
                                <i className="fa-solid fa-circle-check mt-1.5 text-sm text-indigo-400"></i>
                                <span>MLS Satisfaction: Median score of 3/5 (Neutral/Content), signaling a significant gap in high-performing core technology.</span>
                            </li>
                            <li className="flex items-start gap-4 text-base text-indigo-800/80 font-medium leading-relaxed">
                                <i className="fa-solid fa-circle-check mt-1.5 text-sm text-indigo-400"></i>
                                <span>Emerging Tech Gap: Only 8% of Realtors feel proficient enough to teach others, while 59% are "still learning" and 34% have little to no usage.</span>
                            </li>
                            <li className="flex items-start gap-4 text-base text-indigo-800/80 font-medium leading-relaxed">
                                <i className="fa-solid fa-circle-check mt-1.5 text-sm text-indigo-400"></i>
                                <span>GenAI Adoption: While 41% of Realtors have begun utilizing Generative AI, a significant 30% currently utilize no emerging technology tools at all.</span>
                            </li>
                        </ul>
                    </div>
                    <div className="min-w-[300px] lg:border-l lg:border-indigo-200 lg:pl-12 space-y-10">
                        <div className="space-y-1.5">
                            <span className="text-5xl font-black text-indigo-600">$180B</span>
                            <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">McKinsey GenAI Value Add</p>
                        </div>
                        <div className="space-y-4">
                            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">AI Adoption Curve</span>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white/50 rounded-2xl border border-indigo-100/50">
                                    <div className="text-3xl font-black text-indigo-600">20%</div>
                                    <div className="text-xs font-black text-indigo-900/70 uppercase leading-snug mt-1.5">Daily Usage<br />Velocity</div>
                                </div>
                                <div className="p-4 bg-white/50 rounded-2xl border border-indigo-100/50">
                                    <div className="text-3xl font-black text-indigo-400">32%</div>
                                    <div className="text-xs font-black text-indigo-900/50 uppercase leading-snug mt-1.5">Untapped<br />Potential</div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Primary Motivators</span>
                            <div className="space-y-5">
                                {[
                                    { label: "Saving Time", val: 66 },
                                    { label: "Improving client experience", val: 64 },
                                    { label: "Closing more deals", val: 51 }
                                ].map((g, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between text-xs font-black text-indigo-900/70 uppercase">
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
                <div className="flex flex-col lg:flex-row gap-8 items-center">
                    <div className="space-y-4 flex-1">
                        <h3 className="text-3xl font-serif font-black text-slate-900">The Zyphe Product Ecosystem</h3>
                        <div className="text-slate-500 font-medium leading-relaxed space-y-4">
                            <p className="text-sm md:text-base">
                                <strong className="text-slate-900">Built on a 3-pillar product foundation: </strong>
                                <button
                                    onClick={() => { setActiveTab?.('product_market_fit'); onNavigate?.('product_market_fit', '/realtor/product_market_fit'); }}
                                    className="text-indigo-600 font-black hover:underline underline-offset-4"
                                >
                                    Experience
                                </button>
                                <strong className="text-slate-900">, </strong>
                                <button
                                    onClick={() => { setActiveTab?.('product_market_fit'); onNavigate?.('product_market_fit', '/realtor/product_market_fit'); }}
                                    className="text-indigo-600 font-black hover:underline underline-offset-4"
                                >
                                    Functionality
                                </button>
                                <strong className="text-slate-900">, and </strong>
                                <button
                                    onClick={() => { setActiveTab?.('product_market_fit'); onNavigate?.('product_market_fit', '/realtor/product_market_fit'); }}
                                    className="text-indigo-600 font-black hover:underline underline-offset-4"
                                >
                                    Technology
                                </button>
                                <strong className="text-slate-900">.</strong> This architecture ensures every data point—from listing photos to buyer behaviors—is unified into a single ecosystem of intelligence.
                            </p>
                            <p>
                                Zyphe is designed to eliminate the <strong className="text-slate-900">"admin tax"</strong> and modernize the real estate lifecycle through an AI-native ecosystem:
                            </p>
                            <ul className="space-y-3">
                                <li className="flex gap-2 text-base">
                                    <span className="text-indigo-600 font-black">•</span>
                                    <span>
                                        <strong className="text-slate-900">Pillar 1 (</strong>
                                        <button
                                            onClick={() => { setActiveTab?.('product_market_fit'); onNavigate?.('product_market_fit', '/realtor/product_market_fit'); }}
                                            className="text-indigo-600 font-black hover:underline underline-offset-4"
                                        >
                                            Experience
                                        </button>
                                        <strong className="text-slate-900">):</strong> Delightful, intuitive interfaces featuring universal data ingestion and conversational commands that streamline the "Home Story" journey.
                                    </span>
                                </li>
                                <li className="flex gap-2 text-base">
                                    <span className="text-indigo-600 font-black">•</span>
                                    <span>
                                        <strong className="text-slate-900">Pillar 2 (</strong>
                                        <button
                                            onClick={() => { setActiveTab?.('product_market_fit'); onNavigate?.('product_market_fit', '/realtor/product_market_fit'); }}
                                            className="text-indigo-600 font-black hover:underline underline-offset-4"
                                        >
                                            Functionality
                                        </button>
                                        <strong className="text-slate-900">):</strong> A "business-in-a-box" suite, leveraging vision and spatial AI for property analysis alongside a proactive reactivation engine that mines dormant leads.
                                    </span>
                                </li>
                                <li className="flex gap-2 text-base">
                                    <span className="text-indigo-600 font-black">•</span>
                                    <span>
                                        <strong className="text-slate-900">Pillar 3 (</strong>
                                        <button
                                            onClick={() => { setActiveTab?.('product_market_fit'); onNavigate?.('product_market_fit', '/realtor/product_market_fit'); }}
                                            className="text-indigo-600 font-black hover:underline underline-offset-4"
                                        >
                                            Technology
                                        </button>
                                        <strong className="text-slate-900">):</strong> A high-velocity architecture powered by Google technologies and a proprietary Context Graph that unifies visual, geospatial, and behavioral data into a single, grounded source of truth.
                                    </span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="w-full lg:w-[320px] flex-none">
                        <div className="relative group rounded-3xl overflow-hidden border border-slate-200 shadow-xl">
                            <img
                                src="/assets/product_ecosystem.png"
                                alt="Zyphe Product Ecosystem Pillars"
                                className="w-full h-auto transform group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
