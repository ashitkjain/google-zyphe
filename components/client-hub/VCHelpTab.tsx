import React, { useState } from 'react';

type GuideTab = 'dashboard' | 'match' | 'intelligence' | 'video' | 'buyer';

const VCHelpTab: React.FC = () => {
    const [activeTab, setActiveTab] = useState<GuideTab>('dashboard');

    const tabs: { id: GuideTab; label: string; icon: string }[] = [
        { id: 'dashboard', label: '1. Pipeline', icon: 'fa-chart-line' },
        { id: 'match', label: '2. Search', icon: 'fa-wand-magic-sparkles' },
        { id: 'intelligence', label: '3. Intelligence', icon: 'fa-brain' },
        { id: 'video', label: '4. Video call', icon: 'fa-video' },
        { id: 'buyer', label: '5. Buyer hub', icon: 'fa-user' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-chart-line"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Realtor Dashboard & Pipeline</h3>
                                <p className="text-slate-500 font-medium">Review incoming leads and prioritize outreach based on AI insights.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Review the Funnel</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Note the **10 New Leads** in the first column. Identify high-interest indicators (🔥 icons) and motivations like "Need more space for growing family".
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/realtor_dashboard.png" alt="Realtor Dashboard" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">B</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Check Pending Tasks</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Go to **Tools &gt; Tasks**. View urgent tasks such as "Call Sarah Miller" or "Send analysis to David".
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/realtor_tasks.png" alt="Realtor Tasks" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">C</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Examine Communication History</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Go to the **Clients** tab and select a lead (e.g., Robert Thompson). Review the **Communication History** to see past SMS/Email touchpoints.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/realtor_client_history.png" alt="Client History" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'match':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">AI-Driven "Find My Match"</h3>
                                <p className="text-slate-500 font-medium">Transform a buyer's life narrative into structured property matches.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Input a Buyer Story</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Navigate to the **Explore** tab. Use the storyteller box to describe the client's vision (e.g., commute, school quality, lifestyle).
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/explore_story.png" alt="Explore Story" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">B</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Run Matcher & Review Results</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Click **Find My Match**. Watch Gemini extract price, beds, baths, and location filters automatically. Scroll through the ranked results.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/explore_results.png" alt="Explore Results" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'intelligence':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-brain"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Deep Property Intelligence</h3>
                                <p className="text-slate-500 font-medium">Analyze a specific property with story-aware AI insights.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">View AI Concierge Summary</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Read the **Concierge Summary**. Notice how it flags pros/cons specific to the buyer's school and commute needs.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/property_analysis.png" alt="AI Summary" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">B</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Visual Intelligence Report</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Check the **Visual Intelligence Report** for kitchen condition, presence of solar, and architectural style analysis based on property photos.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/property_visual_intelligence.png" alt="Visual Report" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'video':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-video"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Collaborative Video Session</h3>
                                <p className="text-slate-500 font-medium">Engage with the buyer in a live, white-glove video consultation.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Premium Connection UI</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Click the floating **"Call Concierge"** button in the bottom left. This triggers a sleek connection overlay while the secure session is established.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-900 max-w-4xl">
                                    <img src="/images/guide/concierge_call.png" alt="Concierge Call" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'buyer':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-user"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Buyer Portal & Library</h3>
                                <p className="text-slate-500 font-medium">Ensure the buyer has all assets needed to proceed with confidence.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Verify Shared Insights</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Log in as **buyer@fc.com**. Review the shared Guides and AI Reports discussed during the live session in the **Hub**.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/buyer_hub.png" alt="Buyer Hub" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">B</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Knowledge Center & Guides</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Access the **Library** to review custom property educational guides shared by the concierge.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/buyer_library.png" alt="Buyer Library" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="flex items-center gap-4 mb-12">
                <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-indigo-100">
                    <i className="fa-solid fa-graduation-cap"></i>
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 mb-1">Video Concierge Guide</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Professional Training Program</p>
                </div>
            </div>

            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.5rem] mb-12 border border-slate-200 sticky top-4 z-50 shadow-sm backdrop-blur-md bg-white/80">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-[1.2rem] text-sm font-black transition-all duration-300 ${
                            activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]'
                                : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'
                        }`}
                    >
                        <i className={`fa-solid ${tab.icon} ${activeTab === tab.id ? 'animate-pulse' : ''}`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="pb-40">
                {renderContent()}
            </div>
        </div>
    );
};

export default VCHelpTab;
