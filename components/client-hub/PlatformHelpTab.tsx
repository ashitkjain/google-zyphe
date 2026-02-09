import React, { useState } from 'react';

interface HelpTopic {
    id: string;
    title: string;
    icon: string;
    content: React.ReactNode;
}

interface HelpCategory {
    id: string;
    title: string;
    icon: string;
    topics: HelpTopic[];
}

const PlatformHelpTab: React.FC = () => {
    const [activeCategoryId, setActiveCategoryId] = useState('messaging');
    const [activeTopicId, setActiveTopicId] = useState('sms_registration');

    const categories: HelpCategory[] = [
        {
            id: 'getting_started',
            title: 'Getting Started',
            icon: 'fa-flag-checkered',
            topics: [
                { id: 'onboarding', title: 'Account Onboarding', icon: 'fa-user-plus', content: <div className="prose prose-slate"><h2>Account Onboarding</h2><p>Welcome to Zyphe! This guide will help you set up your professional profile and sync your first set of leads.</p></div> }
            ]
        },
        {
            id: 'messaging',
            title: 'Messaging & SMS',
            icon: 'fa-comment-dots',
            topics: [
                {
                    id: 'sms_registration',
                    title: 'SMS Registration (10DLC)',
                    icon: 'fa-comment-sms',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-indigo-100">
                                    <i className="fa-solid fa-comment-sms"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">SMS Registration Guide</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">A2P 10DLC Compliance</p>
                                </div>
                            </div>

                            <section className="bg-indigo-50/50 rounded-[2.5rem] p-10 border border-indigo-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-shield-halved text-indigo-500"></i>
                                    Why is registration required?
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    US mobile carriers (Verizon, AT&T, T-Mobile) now require all businesses to register their messaging traffic.
                                    By registering your business brand, you ensure that your messages are not flagged as spam and reach your clients instantly.
                                    This process is known as <strong>10DLC (10-Digit Long Code) Registration</strong>.
                                </p>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">1</div>
                                        Brand Identity
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                        You'll need to provide your <strong>Legal Business Name</strong> and <strong>Tax ID (EIN)</strong>.
                                        This verifies that you are a legitimate business entity. If you act as an individual, you can register as a sole proprietor using your SSN.
                                    </p>
                                </div>
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">2</div>
                                        Campaign Usage
                                    </h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                                        Select how you plan to use SMS. For most realtors, the <strong>"Agents & Franchises"</strong> use case is appropriate.
                                        You will need to provide sample messages like viewing confirmations or inspection updates.
                                    </p>
                                </div>
                            </div>

                            <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white mb-12 shadow-2xl overflow-hidden relative group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl"></div>
                                <h3 className="text-xl font-black mb-6 relative z-10">The Approval Process</h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-paper-plane text-indigo-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Instant Submission</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Your application is sent immediately once you complete the wizard in <strong>Realtor Tools</strong>.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-clock text-indigo-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Carrier Review (3-7 Days)</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Mobile networks manually review your samples to ensure compliance with anti-spam rules.</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                            <i className="fa-solid fa-check-circle text-emerald-400"></i>
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm mb-1">Active Status</div>
                                            <div className="text-slate-400 text-xs leading-relaxed">Once approved, your messages will have the highest possible delivery priority.</div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100 flex items-start gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-lg shrink-0">
                                    <i className="fa-solid fa-lightbulb"></i>
                                </div>
                                <div>
                                    <h4 className="text-amber-900 font-black text-lg mb-2">Pro Tip</h4>
                                    <p className="text-amber-800 text-sm font-medium leading-relaxed">
                                        Ensure your website URL is valid and clearly mentions your business name.
                                        Carriers will check your website to verify that you have proper "Opt-in" language for clients.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'data_intelligence',
            title: 'Data & Intelligence',
            icon: 'fa-microchip',
            topics: [
                {
                    id: 'solar_estimation',
                    title: 'Solar Production Methodology',
                    icon: 'fa-solar-panel',
                    content: (
                        <div className="prose prose-slate max-w-none">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-indigo-100">
                                    <i className="fa-solid fa-solar-panel"></i>
                                </div>
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 mb-1">Solar Estimation Methodology</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Technical Attribution Guide</p>
                                </div>
                            </div>

                            <section className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 mb-12">
                                <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3">
                                    <i className="fa-solid fa-satellite text-indigo-500 text-sm"></i>
                                    How it works
                                </h2>
                                <p className="text-slate-600 font-medium leading-relaxed">
                                    Zyphe leverages the <strong>Google Solar API</strong> to analyze high-resolution satellite imagery.
                                    Our engine calculates the total roof surface area, orientation, and local sunshine quantiles to provide an
                                    independent production baseline.
                                </p>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                                <div className="bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100/50">
                                    <div className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mb-2">Usability Filter</div>
                                    <div className="text-2xl font-black text-indigo-900 mb-1">50%</div>
                                    <div className="text-slate-500 text-[11px] font-medium">Standard roof area utilization (accounts for fire codes & shading).</div>
                                </div>
                                <div className="bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100/50">
                                    <div className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mb-2">System Efficiency</div>
                                    <div className="text-2xl font-black text-indigo-900 mb-1">85%</div>
                                    <div className="text-slate-500 text-[11px] font-medium">Combined DC/AC conversion and wiring loss factor.</div>
                                </div>
                                <div className="bg-indigo-50/30 p-6 rounded-3xl border border-indigo-100/50">
                                    <div className="text-indigo-600 font-black text-[10px] uppercase tracking-widest mb-2">Panel Standard</div>
                                    <div className="text-2xl font-black text-indigo-900 mb-1">400W</div>
                                    <div className="text-slate-500 text-[11px] font-medium">Industry standard residential panel capacity (1.7m² footprint).</div>
                                </div>
                            </div>

                            <h3 className="text-xl font-black text-slate-800 mb-8 border-l-4 border-indigo-600 pl-6">Step-by-Step Walkthrough</h3>
                            <div className="space-y-12 mb-12">
                                <section>
                                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-8 flex items-center gap-4">
                                        <i className="fa-solid fa-circle-exclamation text-amber-500 text-sm"></i>
                                        <p className="text-amber-900 text-[10px] font-bold leading-relaxed mb-0 uppercase tracking-tight">
                                            Illustrative Example: The following calculations use data from a sample property to demonstrate the methodology.
                                        </p>
                                    </div>
                                    <p className="text-slate-600 font-medium leading-relaxed mb-6">
                                        To estimate the annual energy production for a property, we combine the roof's physical data with the solar irradiance values from high-resolution satellite analysis.
                                        Based on a standard 15% to 20% system efficiency, here is the breakdown:
                                    </p>

                                    <div className="space-y-8">
                                        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                            <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                                <span className="text-indigo-600">1.</span> Determine "Usable" Area
                                            </h4>
                                            <p className="text-slate-500 text-sm leading-relaxed mb-4">
                                                While the total roof area might be large, you typically can't cover 100% due to fire codes, vents, and shading.
                                                We apply usability thresholds:
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Conservative (30%)</div>
                                                    <div className="text-lg font-black text-slate-800">~88 m²</div>
                                                </div>
                                                <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-100">
                                                    <div className="text-[10px] font-black text-white/60 uppercase mb-1">Aggressive (60%)</div>
                                                    <div className="text-lg font-black text-white">~176 m²</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                            <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                                <span className="text-indigo-600">2.</span> Calculate Solar Capacity (kW)
                                            </h4>
                                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                                A standard solar panel (approx. 1.7 m²) produces about 400W (0.4 kW).
                                            </p>
                                            <div className="space-y-4">
                                                <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 italic font-medium text-slate-700">
                                                    <div className="flex-1">
                                                        Total Panels ≈ 176 m² / 1.7 m² per panel ≈ <span className="text-indigo-600 font-black">103 panels</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col md:flex-row md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 italic font-medium text-slate-700">
                                                    <div className="flex-1">
                                                        System Capacity ≈ 103 × 0.4 kW ≈ <span className="text-indigo-600 font-black">41.2 kW</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                            <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                                                <span className="text-indigo-600">3.</span> Annual Energy Production (kWh)
                                            </h4>
                                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                                We apply the <code>maxSunshineHoursPerYear</code> and an efficiency factor (usually 0.85 to account for real-world "DC to AC" losses).
                                            </p>
                                            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm overflow-x-auto">
                                                <div className="font-black text-indigo-900 text-sm mb-4 uppercase tracking-widest text-center opacity-40">The Formula</div>
                                                <div className="text-center text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                                                    Capacity (kW) × Sunshine Hours × 0.85
                                                </div>
                                                <div className="h-px bg-slate-100 my-4"></div>
                                                <div className="text-center text-2xl font-black text-indigo-600">
                                                    41.2 × 1771 × 0.85 ≈ <span className="text-indigo-950">62,000 kWh/year</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <section className="bg-emerald-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden mb-12">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-1/4 -translate-y-1/4 blur-3xl"></div>
                                <h3 className="text-xl font-black mb-6 relative z-10">Impact Summary</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-sm">
                                                <i className="fa-solid fa-leaf"></i>
                                            </div>
                                            <div className="font-bold text-lg">Carbon Saved</div>
                                        </div>
                                        <p className="text-emerald-100 text-xs leading-relaxed">
                                            Producing 62 MWh per year would offset approximately <span className="text-white font-black italic">26,593 kg of CO₂</span> annually.
                                        </p>
                                    </div>
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-sm">
                                                <i className="fa-solid fa-magnifying-glass-chart"></i>
                                            </div>
                                            <div className="font-bold text-lg">Roof Insights</div>
                                        </div>
                                        <p className="text-indigo-100 text-xs leading-relaxed">
                                            A wide gap between sunshine quantiles suggests significant shading or varied orientations (e.g., North vs South facing slopes).
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'account',
            title: 'Account Settings',
            icon: 'fa-user-gear',
            topics: [
                { id: 'profile', title: 'Updating your Profile', icon: 'fa-id-card', content: <div className="prose prose-slate"><h2>Updating your Profile</h2><p>Change your professional info, headshot, and branding settings.</p></div> }
            ]
        }
    ];

    const activeCategory = categories.find(c => c.id === activeCategoryId) || categories[1];
    const activeTopic = activeCategory.topics.find(t => t.id === activeTopicId) || activeCategory.topics[0];

    return (
        <div className="flex h-full bg-slate-50 animate-in fade-in duration-500">
            {/* Help Sidebar */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col pt-8">
                <div className="px-6 mb-8">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Help Categories</h2>
                </div>
                <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-8">
                    {categories.map((cat) => (
                        <div key={cat.id} className="space-y-1">
                            <button
                                onClick={() => {
                                    setActiveCategoryId(cat.id);
                                    setActiveTopicId(cat.topics[0].id);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${activeCategoryId === cat.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <i className={`fa-solid ${cat.icon} text-sm ${activeCategoryId === cat.id ? 'text-indigo-600' : 'text-slate-300'}`}></i>
                                <span className="text-xs font-black uppercase tracking-wider">{cat.title}</span>
                            </button>

                            {activeCategoryId === cat.id && (
                                <div className="pl-6 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                    {cat.topics.map((topic) => (
                                        <button
                                            key={topic.id}
                                            onClick={() => setActiveTopicId(topic.id)}
                                            className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTopicId === topic.id ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {topic.title}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="max-w-4xl mx-auto px-12 py-16">
                    {activeTopic.content}
                </div>
            </div>
        </div>
    );
};

export default PlatformHelpTab;
