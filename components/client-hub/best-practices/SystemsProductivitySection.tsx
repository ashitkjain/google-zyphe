import React from 'react';

const SystemsProductivitySection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Systems & Productivity Standards</h2>
                <p className="text-lg text-slate-500 font-medium">Optimizing operations and daily rituals for peak performance.</p>
            </div>


            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                <p className="text-indigo-800 leading-relaxed font-medium">
                    To scale your business, you must move from "doing everything" to "managing systems." Effective tools, time blocking, and clear processes allow you to handle more volume without burnout.
                </p>
            </div>

            <div className="space-y-12">
                {/* 1. CRM Mastery */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <span className="font-bold text-lg">1</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">CRM Mastery: Your Business Hub</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">Why It Matters</h4>
                            <p className="text-sm text-slate-600 mb-3">If it's not in the CRM, it didn't happen. Centralize data to prevent leaks.</p>
                            <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                                <li>Track conversation history.</li>
                                <li>Set automated task reminders.</li>
                                <li>Categorize leads (Hot, Warm, Cold).</li>
                            </ul>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                            <h4 className="font-bold text-slate-900 mb-2">Daily CRM Habits</h4>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <i className="fa-regular fa-clock text-blue-500"></i>
                                    <span className="text-sm text-slate-700">Morning: Review tasks & hot leads.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <i className="fa-regular fa-clock text-blue-500"></i>
                                    <span className="text-sm text-slate-700">Mid-day: Log calls & notes immediately.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <i className="fa-regular fa-clock text-blue-500"></i>
                                    <span className="text-sm text-slate-700">Evening: Plan specifically for tomorrow.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Time Blocking */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                            <span className="font-bold text-lg">2</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Time Blocking for Focus</h3>
                    </div>
                    <p className="text-slate-600 mb-6">Protect your most profitable hours from distractions. Treat these blocks as non-negotiable appointments.</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                            <div className="font-bold text-emerald-800 mb-1">Lead Gen</div>
                            <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-2">8:00 - 10:00 AM</div>
                            <p className="text-xs text-emerald-700">Prospecting, follow-ups.</p>
                        </div>
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
                            <div className="font-bold text-amber-800 mb-1">Admin/Prep</div>
                            <div className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-2">10:00 - 12:00 PM</div>
                            <p className="text-xs text-amber-700">Emails, paperwork, showing prep.</p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-center">
                            <div className="font-bold text-indigo-800 mb-1">Appointments</div>
                            <div className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-2">1:00 - 5:00 PM</div>
                            <p className="text-xs text-indigo-700">Showings, listings, meetings.</p>
                        </div>
                    </div>
                </div>

                {/* 3. Automation Tools */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                            <span className="font-bold text-lg">3</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Leverage Automation</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">What to Automate</h4>
                            <ul className="space-y-3">
                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-indigo-500">Email Drip Campaigns:</span> Nurture long-term leads.</li>
                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-indigo-500">Appointment Scheduling:</span> Use Calendly or similar tools.</li>
                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-indigo-500">Social Posting:</span> Schedule content in batches.</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">What NEVER to Automate</h4>
                            <ul className="space-y-3">
                                <li className="flex gap-3 text-sm text-slate-600"><i className="fa-solid fa-ban text-rose-500 mt-1"></i> Sensitive negotiations.</li>
                                <li className="flex gap-3 text-sm text-slate-600"><i className="fa-solid fa-ban text-rose-500 mt-1"></i> Immediate crisis management.</li>
                                <li className="flex gap-3 text-sm text-slate-600"><i className="fa-solid fa-ban text-rose-500 mt-1"></i> Personal relationship building.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 4. Team Delegation */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center">
                            <span className="font-bold text-lg">4</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Scalability & Delegation</h3>
                    </div>
                    <p className="text-slate-600 mb-6">Focus on your highest dollar-per-hour activities (negotiating, prospecting). Delegate the rest as soon as you can afford it.</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="border border-slate-200 p-4 rounded-xl">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">First Hire</div>
                            <div className="font-bold text-slate-900 text-lg">Transaction Coordinator</div>
                            <p className="text-sm text-slate-500 mt-1">Handles paperwork to closing.</p>
                        </div>
                        <div className="border border-slate-200 p-4 rounded-xl">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Second Hire</div>
                            <div className="font-bold text-slate-900 text-lg">Virtual Assistant</div>
                            <p className="text-sm text-slate-500 mt-1">Marketing, data entry, basics.</p>
                        </div>
                    </div>
                </div>

                {/* Checklist */}
                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                        <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white text-xl">
                            <i className="fa-solid fa-check"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black tracking-tight">Productivity Audit</h3>
                            <p className="text-orange-200">Are you optimized?</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        {[
                            'CRM is updated daily',
                            'Lead follow-up plans are automated',
                            'Calendar is time-blocked for key activities',
                            'Marketing content is scheduled in advance',
                            'Transaction checklists are standardized',
                            'Admin tasks are batched or delegated'
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-orange-500/20 border border-orange-500 flex items-center justify-center flex-shrink-0">
                                    <i className="fa-solid fa-check text-[10px] text-orange-400"></i>
                                </div>
                                <span className="text-sm font-medium text-slate-300">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default SystemsProductivitySection;
