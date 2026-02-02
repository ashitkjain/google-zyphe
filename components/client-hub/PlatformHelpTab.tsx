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
