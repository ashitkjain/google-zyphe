import React from 'react';

const CommunicationSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Realtor Communication Best Practices</h2>
                <p className="text-lg text-slate-500 font-medium">Follow-Up, Timelines, and Client Engagement Strategies.</p>
            </div>

            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                <p className="text-indigo-800 leading-relaxed font-medium">
                    Effective communication is the backbone of any successful real estate career. Agents who master communication not only reduce stress and confusion for their clients but also build trust, referrals, and repeat business.
                </p>
            </div>

            <div className="space-y-12">
                {/* 1. Response Time Benchmarks */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <span className="font-bold text-lg">1</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Response Time Benchmarks: Why Speed Matters</h3>
                    </div>
                    <p className="text-slate-600 mb-6">According to industry research, leads contacted within 5 minutes are 21x more likely to convert. Speed builds trust.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { label: 'Initial Inquiry', time: '15-30 Minutes', desc: 'Critical for conversion.' },
                            { label: 'Ongoing Questions', time: '1 Business Day', desc: 'Acknowledge receipt if answer isn’t ready.' },
                            { label: 'After Showings/Offers', time: '24 Hours', desc: 'Summarize feedback and next steps.' }
                        ].map((item, i) => (
                            <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{item.label}</div>
                                <div className="text-lg font-black text-indigo-600 mb-1">{item.time}</div>
                                <div className="text-sm text-slate-500">{item.desc}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg flex items-start gap-2">
                        <i className="fa-regular fa-lightbulb mt-1"></i>
                        <span><strong>Tip:</strong> Even a short acknowledgment like "I received your question and will get back to you by 4 PM" keeps clients reassured.</span>
                    </div>
                </div>

                {/* 2. Preferred Channels */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                            <span className="font-bold text-lg">2</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Preferred Communication Channels</h3>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">Channel</th>
                                    <th className="px-6 py-3">Best Use Case</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                <tr>
                                    <td className="px-6 py-4 font-medium text-slate-900"><i className="fa-solid fa-phone mr-2 text-slate-400"></i> Phone Call</td>
                                    <td className="px-6 py-4 text-slate-600">Urgent updates, complex questions, sensitive negotiations</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 font-medium text-slate-900"><i className="fa-solid fa-comment mr-2 text-slate-400"></i> Text / SMS</td>
                                    <td className="px-6 py-4 text-slate-600">Quick confirmations, showing reminders, short updates</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 font-medium text-slate-900"><i className="fa-solid fa-envelope mr-2 text-slate-400"></i> Email</td>
                                    <td className="px-6 py-4 text-slate-600">Formal communications, contracts, detailed explanations</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 3. Weekly Update Framework */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <span className="font-bold text-lg">3</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Weekly Update Framework</h3>
                    </div>
                    <p className="text-slate-600 mb-6">A structured schedule prevents unnecessary anxiety. Tell clients: "You’ll receive a weekly update every Friday."</p>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <div className="font-bold text-indigo-900 mb-2">Monday</div>
                            <div className="text-sm text-indigo-700">Market recap & new listing alerts</div>
                        </div>
                        <div className="flex-1 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <div className="font-bold text-indigo-900 mb-2">Wednesday</div>
                            <div className="text-sm text-indigo-700">Follow-up on showings or inspections</div>
                        </div>
                        <div className="flex-1 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <div className="font-bold text-indigo-900 mb-2">Friday</div>
                            <div className="text-sm text-indigo-700">Summary of feedback & next steps</div>
                        </div>
                    </div>
                </div>

                {/* 4. Scripts for Difficult Conversations */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                            <span className="font-bold text-lg">4</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Scripts for Difficult Conversations</h3>
                    </div>
                    <div className="space-y-4">
                        {[
                            {
                                scenario: 'Multiple Offers Lost',
                                script: '“The home received several strong offers, which is common in this market. Let’s review what we can adjust to improve your next offer and keep you competitive.”'
                            },
                            {
                                scenario: 'Appraisal Coming in Low',
                                script: '“The appraisal is below the purchase price. Here are our options: renegotiate with the seller, request a second appraisal, or review your financing plan.”'
                            },
                            {
                                scenario: 'Delayed Closing / Issues',
                                script: '“There’s a slight delay with the report. I’ve confirmed the new timeline and will keep you updated immediately as soon as we receive news.”'
                            }
                        ].map((item, i) => (
                            <div key={i} className="border-l-4 border-rose-300 pl-4 py-1">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{item.scenario}</div>
                                <div className="text-slate-700 italic font-medium">"{item.script}"</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 5. Timeline */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                            <span className="font-bold text-lg">5</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Communication Timeline</h3>
                    </div>
                    <div className="grid gap-2">
                        {[
                            { stage: 'Lead Inquiry', action: 'Response within 15-30 mins' },
                            { stage: 'Pre-Approval', action: 'Detailed email + phone call (24h)' },
                            { stage: 'Property Showings', action: 'Immediate feedback after viewing' },
                            { stage: 'Offer Submission', action: 'Phone call to review terms' },
                            { stage: 'Inspection Phase', action: '24-hour updates on items' },
                            { stage: 'Closing Week', action: 'Daily check-ins' }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <span className="font-medium text-slate-900">{item.stage}</span>
                                <span className="text-sm font-bold text-indigo-600">{item.action}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 6. Bonus Tips */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                        { title: 'Consistency Beats Speed', text: 'Regular updates are better than erratic fast ones.' },
                        { title: 'Document Everything', text: 'Track all calls and texts in your CRM.' },
                        { title: 'Use Templates Wisely', text: 'Standardize updates but personalize the details.' },
                        { title: 'Proactive > Reactive', text: 'Update even if there is no news.' }
                    ].map((item, i) => (
                        <div key={i} className="bg-gradient-to-br from-white to-slate-50 p-5 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                            <p className="text-sm text-slate-500">{item.text}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Checklist */}
            <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                        <i className="fa-solid fa-check-double"></i>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black tracking-tight">Next Steps for Realtors</h3>
                        <p className="text-indigo-200">Actionable Takeaways</p>
                    </div>
                </div>
                <div className="space-y-4">
                    {[
                        'Set clear response time benchmarks for yourself',
                        'Ask clients their preferred communication channel at the first meeting',
                        'Implement a weekly update framework and stick to it',
                        'Prepare scripts for difficult scenarios in advance',
                        'Track all communications in your CRM for accountability'
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
    );
};

export default CommunicationSection;
