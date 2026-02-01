import React from 'react';

const BrandingDevelopmentSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Personal Branding & Development</h2>
                <p className="text-lg text-slate-500 font-medium">Crafting a premium identity and long-term reputation.</p>
            </div>


            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                <p className="text-indigo-800 leading-relaxed font-medium">
                    Success is about more than closing deals—it's about professional growth and personal branding. By investing in your brand, building a strong network, and mastering time management, you attract better leads and build a sustainable business.
                </p>
            </div>

            <div className="space-y-12">
                {/* 1. Personal Branding */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <span className="font-bold text-lg">1</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Personal Branding Best Practices</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                                <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-3">
                                    <i className="fa-solid fa-camera"></i>
                                </div>
                                <h4 className="font-bold text-slate-900 mb-2">Visual Identity</h4>
                                <p className="text-sm text-slate-600">Invest in pro headshots and lifestyle photos. Maintain consistent colors/logos across all social platforms.</p>
                            </div>
                            <div className="p-5 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                                <div className="w-10 h-10 bg-fuchsia-100 text-fuchsia-600 rounded-lg flex items-center justify-center mb-3">
                                    <i className="fa-solid fa-bullhorn"></i>
                                </div>
                                <h4 className="font-bold text-slate-900 mb-2">Messaging & PR</h4>
                                <p className="text-sm text-slate-600">Define your niche (Luxury, First-Time). Publish guest posts, speak at events, and highlight certifications.</p>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-600 to-blue-600 p-6 rounded-2xl text-white shadow-xl">
                            <h4 className="font-bold text-xl mb-4 border-b border-white/20 pb-4">Social Media Consistency</h4>
                            <ul className="space-y-4 text-sm font-medium text-indigo-50">
                                <li className="flex gap-3 items-center"><i className="fa-brands fa-instagram text-xl"></i> Share client success stories & personal insights.</li>
                                <li className="flex gap-3 items-center"><i className="fa-brands fa-linkedin text-xl"></i> Post market updates & thought leadership.</li>
                                <li className="flex gap-3 items-center"><i className="fa-solid fa-quote-left text-xl"></i> "People buy from people they know, like, and trust."</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 2. Networking */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                            <span className="font-bold text-lg">2</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Networking & Relationships</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 border border-slate-200 rounded-xl text-center hover:bg-slate-50 transition-colors">
                            <div className="text-3xl text-emerald-500 mb-3"><i className="fa-solid fa-handshake"></i></div>
                            <h4 className="font-bold text-slate-900 mb-1">Local Events</h4>
                            <p className="text-xs text-slate-500">Chamber meetings, community gatherings.</p>
                        </div>
                        <div className="p-4 border border-slate-200 rounded-xl text-center hover:bg-slate-50 transition-colors">
                            <div className="text-3xl text-amber-500 mb-3"><i className="fa-solid fa-briefcase"></i></div>
                            <h4 className="font-bold text-slate-900 mb-1">Partnerships</h4>
                            <p className="text-xs text-slate-500">Lenders, designers, relocation services.</p>
                        </div>
                        <div className="p-4 border border-slate-200 rounded-xl text-center hover:bg-slate-50 transition-colors">
                            <div className="text-3xl text-blue-500 mb-3"><i className="fa-solid fa-users-rectangle"></i></div>
                            <h4 className="font-bold text-slate-900 mb-1">Associations</h4>
                            <p className="text-xs text-slate-500">NAR, local boards for mentorship.</p>
                        </div>
                        <div className="p-4 border border-slate-200 rounded-xl text-center hover:bg-slate-50 transition-colors">
                            <div className="text-3xl text-rose-500 mb-3"><i className="fa-solid fa-address-book"></i></div>
                            <h4 className="font-bold text-slate-900 mb-1">Log It</h4>
                            <p className="text-xs text-slate-500">Track contacts and follow-up religiously.</p>
                        </div>
                    </div>
                </div>

                {/* 3. Time Management */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <span className="font-bold text-lg">3</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Time Management & Productivity</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8 items-center">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-4">The "High-Value" Rule</h4>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                                    <span className="font-bold text-emerald-800 text-sm">Client Calls & Showings</span>
                                    <span className="px-2 py-1 bg-emerald-200 text-emerald-800 text-xs rounded-full font-bold">$$$</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                                    <span className="font-bold text-emerald-800 text-sm">Negotiating Contracts</span>
                                    <span className="px-2 py-1 bg-emerald-200 text-emerald-800 text-xs rounded-full font-bold">$$$</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg opacity-60">
                                    <span className="font-bold text-slate-600 text-sm">Social Media Scroll</span>
                                    <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded-full font-bold">$0</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg opacity-60">
                                    <span className="font-bold text-slate-600 text-sm">Admin Work (Delegate)</span>
                                    <span className="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded-full font-bold">$</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><i className="fa-solid fa-clock text-slate-400"></i> Daily Routine Prototype</h4>
                            <ul className="space-y-4 text-sm text-slate-600">
                                <li className="flex gap-3">
                                    <span className="font-mono text-indigo-500 font-bold w-16">08:00 AM</span>
                                    <span>Planning & Focused Work (No Email)</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-mono text-indigo-500 font-bold w-16">10:00 AM</span>
                                    <span>Lead Follow-Up Blocks</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-mono text-indigo-500 font-bold w-16">01:00 PM</span>
                                    <span>Appointments & Showings</span>
                                </li>
                                <li className="flex gap-3">
                                    <span className="font-mono text-indigo-500 font-bold w-16">04:00 PM</span>
                                    <span>Admin Wrap-Up & Prep for Tomorrow</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                            <i className="fa-solid fa-ranking-star"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black tracking-tight">Top Performer Checklist</h3>
                            <p className="text-indigo-200">Scale Your Brand & Business</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        {[
                            'Update headshots & social media branding',
                            'Define your unique value proposition',
                            'Attend one local networking event weekly',
                            'Maintain a networking log of contacts',
                            'Time-block high-value activities daily',
                            'Review performance metrics weekly'
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
                                </div>
                                <span className="text-lg font-medium text-slate-200">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default BrandingDevelopmentSection;
