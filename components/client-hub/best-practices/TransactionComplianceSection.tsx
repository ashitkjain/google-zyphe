import React from 'react';

const TransactionComplianceSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Transaction Management & Compliance</h2>
                <p className="text-lg text-slate-500 font-medium">Protecting Your Client and Your License.</p>
            </div>

            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                <p className="text-indigo-800 leading-relaxed font-medium">
                    A signed contract is just the beginning. Meticulous transaction management ensures the deal closes on time, while strict compliance protects all parties from legal and financial risks.
                </p>
            </div>

            <div className="space-y-12">
                {/* 1. The Critical Timeline */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <span className="font-bold text-lg">1</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">The Critical Timeline</h3>
                    </div>
                    <p className="text-slate-600 mb-6">Missing a deadline can kill a deal. Create a master calendar immediately upon acceptance.</p>
                    <div className="space-y-3">
                        {[
                            { day: 'Day 0-3', task: 'Earnest Money Deposit (EMD)', desc: 'Ensure receipt is documented immediately.' },
                            { day: 'Day 7-10', task: 'Inspection Period Ends', desc: 'Negotiate repairs or credits before this expires.' },
                            { day: 'Day 21-25', task: 'Loan Commitment', desc: 'Clear conditions with lender.' },
                            { day: 'Day 30+', task: 'Closing', desc: 'Final walkthrough & signing.' }
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded w-20 text-center">{item.day}</span>
                                <div className="flex-1">
                                    <span className="font-bold text-slate-900 block">{item.task}</span>
                                    <span className="text-xs text-slate-500">{item.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Documentation Hygiene */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                            <span className="font-bold text-lg">2</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Documentation Hygiene</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-2">Paperwork Best Practices</h4>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <i className="fa-solid fa-file-signature text-purple-500 mt-1"></i>
                                    <div>
                                        <span className="block text-sm font-bold text-slate-800">Review Before Sending</span>
                                        <span className="block text-xs text-slate-500">Never send a blank contract. Explain what they are signing.</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <i className="fa-solid fa-folder-open text-purple-500 mt-1"></i>
                                    <div>
                                        <span className="block text-sm font-bold text-slate-800">Organize Immediately</span>
                                        <span className="block text-xs text-slate-500">Upload signed docs to your compliance platform same-day.</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <i className="fa-solid fa-clock-rotate-left text-purple-500 mt-1"></i>
                                    <div>
                                        <span className="block text-sm font-bold text-slate-800">Version Control</span>
                                        <span className="block text-xs text-slate-500">Keep track of counter-offers and amendments clearly.</span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className="bg-purple-50 p-6 rounded-xl border border-purple-100">
                            <h4 className="font-bold text-purple-900 mb-3">Red Flags to Watch For</h4>
                            <ul className="space-y-2 text-sm text-purple-800 list-disc list-inside">
                                <li>Incomplete seller disclosures.</li>
                                <li>Ambiguous language in special stipulations.</li>
                                <li>Unsigned addenda.</li>
                                <li>Deadlines falling on weekends/holidays (adjust accordingly).</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 3. Risk Management */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                            <span className="font-bold text-lg">3</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Risk Management</h3>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="font-bold text-slate-900 mb-2">Wire Fraud</div>
                            <p className="text-xs text-slate-600">Always warn clients: <span className="font-bold">Never wire funds based on an email.</span> Always call to verify instructions.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="font-bold text-slate-900 mb-2">Fair Housing</div>
                            <p className="text-xs text-slate-600">Treat everyone equally. Focus on the property, not the people. Stick to objective criteria.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="font-bold text-slate-900 mb-2">Scope of Expertise</div>
                            <p className="text-xs text-slate-600">Don't be a lawyer, creating contract language. Don't be an inspector. Refer experts.</p>
                        </div>
                    </div>
                </div>

                {/* Checklist */}
                <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white text-xl">
                            <i className="fa-solid fa-file-shield"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black tracking-tight">Compliance Checklist</h3>
                            <p className="text-indigo-200">Every Transaction</p>
                        </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        {[
                            'Agency disclosure signed first',
                            'Purchase agreement fully executed',
                            'Seller property disclosures received',
                            'Lead-based paint disclosure (if applicable)',
                            'Earnest money receipt on file',
                            'Inspection resolution signed',
                            'Final closing statement reviewed'
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                    <i className="fa-solid fa-check text-[10px] text-white"></i>
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

export default TransactionComplianceSection;
