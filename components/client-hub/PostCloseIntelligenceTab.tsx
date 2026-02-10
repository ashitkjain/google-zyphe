
import React from 'react';

const PostCloseIntelligenceTab: React.FC = () => {
    const roadmapData = [
        { system: 'HVAC (Attic)', status: '2022 Carrier Unit', action: 'Replace MERV 11 filter (16x25x1).', schedule: 'March 2026' },
        { system: 'Water Heater', status: 'Minor sediment noted.', action: 'Flush tank to extend service life.', schedule: 'April 2026' },
        { system: 'Exterior Gutters', status: 'Debris in NE corner.', action: 'Clear before spring rains.', schedule: 'Next 30 Days' },
        { system: 'Smoke/CO²', status: 'Verified working.', action: 'Test monthly / Replace batteries.', schedule: 'Monthly' },
    ];

    const gapComparison = [
        { feature: 'Inspection Reports', tms: 'PDF buried in a compliance folder.', vision: 'Converted into a Digital Maintenance Schedule with alerts.' },
        { feature: 'Floor Plans', tms: 'Used for appraisal/marketing and then deleted.', vision: 'Uploaded to a Spatial AI app for furniture layouts or renovation ideas.' },
        { feature: 'Closing Disclosures', tms: 'Used for tax records only.', vision: 'Used to trigger Property Tax Appeal alerts or equity tracking.' },
        { feature: 'Appliance Data', tms: 'Discovered during walk-through and forgotten.', vision: 'Added to a "Smart Manual" that tracks filters and warranty.' },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-600 w-fit">
                    <i className="fa-solid fa-key"></i>
                    Asset Management 2026
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight max-w-4xl">
                    Post-Close Intelligence: The "Missing Middle"
                </h1>
                <p className="text-slate-500 font-medium max-w-3xl leading-relaxed text-lg">
                    Transitioning from a transactional mindset to a relationship-centric model. Harnessing "dark data"
                    from compliance vaults to create long-term client value and predictive selling opportunities.
                </p>
            </div>

            {/* Problem & Gap Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <section className="bg-slate-900 rounded-[3rem] p-10 text-white space-y-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full -mr-32 -mt-32"></div>
                    <div className="relative z-10 space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Section 01</h3>
                        <h2 className="text-2xl font-black">The "Digital Vault" Paradox</h2>
                        <p className="text-slate-400 text-sm leading-relaxed font-medium">
                            Critical "Home Intelligence" (inspections, floor plans, warranties) is collected during
                            the transaction but immediately archived to satisfy regulations, becoming inaccessible "dark data."
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <i className="fa-solid fa-cloud-arrow-down text-indigo-400 mb-3 block"></i>
                            <h4 className="text-sm font-black mb-1">Data Entrapment</h4>
                            <p className="text-[10px] text-slate-500 leading-relaxed">HVAC age, roof condition, and appliance serials trapped in PDFs.</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                            <i className="fa-solid fa-vault text-rose-400 mb-3 block"></i>
                            <h4 className="text-sm font-black mb-1">Compliance Archive</h4>
                            <p className="text-[10px] text-slate-500 leading-relaxed">Valuable insights locked away in SkySlope or Lone Wolf.</p>
                        </div>
                    </div>
                </section>

                <section className="bg-white rounded-[3rem] border border-slate-100 p-10 space-y-8 shadow-sm">
                    <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Section 02</h3>
                        <h2 className="text-2xl font-black text-slate-900">The "Home Lifecycle" Disconnect</h2>
                        <p className="text-slate-500 text-sm leading-relaxed font-medium">
                            Zyphe bridges the automated "handshake" between Transaction Management and a Client-Facing Home App.
                        </p>
                    </div>
                    <div className="space-y-4">
                        {gapComparison.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex flex-col gap-2 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{item.feature}</span>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-[10px] text-slate-400 font-medium italic">TMS: {item.tms}</div>
                                    <div className="text-[10px] text-slate-900 font-bold">Zyphe: {item.vision}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* Opportunity Section */}
            <section className="bg-indigo-600 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 blur-[100px] rounded-full -mb-48 -mr-48"></div>
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div className="lg:col-span-1 space-y-6">
                        <h2 className="text-3xl font-black leading-tight">The 2026 Opportunity</h2>
                        <p className="text-indigo-100 font-medium leading-relaxed">
                            Only 13% of homeowners use the same agent twice. Post-Close Intelligence fixes the loyalty crisis.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest">
                            <i className="fa-solid fa-chart-line"></i>
                            Predictive Selling
                        </div>
                    </div>
                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-[2rem] text-slate-900 space-y-3">
                            <h4 className="font-black text-indigo-600 uppercase tracking-widest text-[10px]">The Zyphe Edge</h4>
                            <p className="text-sm font-bold leading-relaxed">
                                AI sits on top of the vault, scanning archived documents to extract actionable advice for the client.
                            </p>
                        </div>
                        <div className="border border-white/20 p-8 rounded-[2rem] text-white space-y-3">
                            <h4 className="font-black text-indigo-300 uppercase tracking-widest text-[10px]">Maintenance Cycle</h4>
                            <p className="text-sm font-medium leading-relaxed">
                                Tells the agent when a home is "ready" to sell based on aging systems like roof or HVAC status.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Implementation Plan */}
            <section className="space-y-10">
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Implementation Plan</h2>
                    <p className="text-slate-500 font-medium">Turning the "static" closing file into a dynamic "Home Dashboard."</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[
                        { step: '01', title: 'Data Extraction', desc: 'Use AI to scan Inspection Reports and CD for appliance specs and maintenance debt.' },
                        { step: '02', title: 'Maintenance Roadmap', desc: 'Transform inspection items into a 365-Day Home Care Calendar with personalized alerts.' },
                        { step: '03', title: 'Visual Memory Vault', desc: 'Upload floorplans and photos. Use Spatial AI for virtual remodeling ideas.' },
                        { step: '04', title: 'Annual ROI Briefing', desc: 'Send an ROI analysis of property values and recommended refresh projects.' },
                        { step: '05', title: 'Vendor Integration', desc: 'Provide a "One-Click" connection to vetted contractors when alerts trigger.' },
                    ].map((plan, i) => (
                        <div key={i} className="bg-white border border-slate-100 p-8 rounded-3xl hover:shadow-xl hover:border-indigo-100 transition-all group">
                            <span className="text-4xl font-black text-slate-100 group-hover:text-indigo-50 transition-colors block mb-4">{plan.step}</span>
                            <h4 className="text-lg font-black text-slate-900 mb-2">{plan.title}</h4>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">{plan.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Sample Report Section */}
            <section className="bg-slate-50 rounded-[3rem] p-12 border border-slate-200/50 space-y-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Dynamic Prototype</h3>
                        <h2 className="text-3xl font-black text-slate-900">[Client Name]’s Home Intelligence Report</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Property: 123 Pleasanton Way, CA</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Closing Date: Jan 10, 2026</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl p-8 shadow-sm">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                <i className="fa-solid fa-calendar-check text-indigo-500"></i>
                                Digital Maintenance Roadmap
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-50">
                                            <th className="pb-4">System</th>
                                            <th className="pb-4">Status</th>
                                            <th className="pb-4">Action Required</th>
                                            <th className="pb-4">Schedule</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {roadmapData.map((row, i) => (
                                            <tr key={i} className="text-[11px] font-medium text-slate-600">
                                                <td className="py-4 font-black text-slate-900">{row.system}</td>
                                                <td className="py-4">{row.status}</td>
                                                <td className="py-4 text-indigo-600">{row.action}</td>
                                                <td className="py-4 font-bold text-slate-900">{row.schedule}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-indigo-900 rounded-3xl p-8 text-white shadow-xl">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6 underline decoration-indigo-500/50 underline-offset-4">Financial Health</h4>
                            <div className="space-y-6">
                                <div className="flex justify-between items-end pb-4 border-b border-white/5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Current Value</span>
                                    <div className="text-right">
                                        <div className="text-xl font-black">$1,262,000</div>
                                        <div className="text-[8px] font-black text-emerald-400 uppercase">+1% Appreciation</div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-end pb-4 border-b border-white/5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">Home Equity</span>
                                    <div className="text-xl font-black">$262,000</div>
                                </div>
                                <div className="bg-white/5 rounded-2xl p-4 space-y-2">
                                    <span className="text-[9px] font-black text-emerald-400 uppercase">ROI Opportunity</span>
                                    <p className="text-[10px] text-slate-300 font-medium leading-relaxed italic">
                                        "Primary Bath Refresh is projected to add $18k – $22k in value with an $8k spend."
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl p-8 border border-slate-200">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Local Context</h4>
                            <ul className="space-y-3">
                                <li className="text-[10px] font-medium text-slate-600 flex items-start gap-3">
                                    <i className="fa-solid fa-bell text-rose-500 mt-0.5"></i>
                                    <span>Property Tax Alert: File Homeowner's Exemption by April.</span>
                                </li>
                                <li className="text-[10px] font-medium text-slate-600 flex items-start gap-3">
                                    <i className="fa-solid fa-utensils text-amber-500 mt-0.5"></i>
                                    <span>"Chaat Bhavan" weekend brunch is highly recommended!</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA / Next Steps */}
            <div className="flex flex-col items-center text-center gap-8 py-10">
                <div className="w-16 h-1 w-24 bg-indigo-100 rounded-full"></div>
                <div className="max-w-2xl space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Ready to bridge the gap?</h2>
                    <p className="text-sm font-medium text-slate-500 italic">
                        "Your Zyphe 'Home Intelligence' Dashboard is ready. You can see live equity tracking and floorplans right now."
                    </p>
                </div>
                <button className="px-10 py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-slate-900 transition-all hover:-translate-y-1">
                    Send Link to Client
                </button>
            </div>
        </div>
    );
};

export default PostCloseIntelligenceTab;
