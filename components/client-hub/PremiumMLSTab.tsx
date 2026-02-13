import React from 'react';

const PremiumMLSTab: React.FC = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-32">
            {/* Header Section */}
            <section className="space-y-4">
                <div className="flex items-center gap-6 text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">
                    <i className="fa-solid fa-house-lock text-base"></i>
                    <span>Compliance & Attribution</span>
                </div>
                <h1 className="text-6xl font-serif font-black text-slate-900 leading-[1.1] tracking-tight">
                    Premium <span className="text-indigo-600">MLS Attribution</span>
                </h1>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                {/* Left Column: Requirements */}
                <div className="lg:col-span-5 space-y-8">
                    <div className="space-y-6">
                        <h3 className="text-2xl font-black text-slate-900 leading-tight">External data attribution requirements.</h3>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            We're able to provide our nation-wide premium MLS data in partnership with an Endeavoring National Brokerage who acts as the Broker of Record (BOR) to enable proper licensing and usage compliance for external usage of the Premium MLS add-on data.
                        </p>
                        <p className="text-slate-500 font-medium leading-relaxed">
                            For that reason there are a few steps, beyond just plugging into the MLS endpoints, required to prove broker-control, and compliance across the MLSs.
                        </p>
                        <p className="text-slate-500 font-medium leading-relaxed italic border-l-4 border-indigo-100 pl-6">
                            In addition to the approval process, when presenting Premium MLS data or search (from our MLS endpoints) in dynamic web pages or applications to external users you'll need to comply with the following data attribution steps.
                        </p>
                    </div>

                    <div className="space-y-6">
                        {[
                            {
                                id: 4,
                                title: "MLS Disclaimers",
                                desc: "Each MLS has disclaimers that are included and must be at the footer. This copy is provided dynamically, per MLS, via MLS API response object."
                            },
                            {
                                id: 5,
                                title: "Broker Partner Disclaimers",
                                desc: "Must be at the footer of each page."
                            }
                        ].map((req) => (
                            <div key={req.id} className="flex gap-4 group">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 font-black text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    {req.id}
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-black text-slate-900 text-sm">{req.title}</h4>
                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{req.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            *Requirement displays are for demonstration purposes only.
                        </p>
                    </div>
                </div>

                {/* Right Column: Visual Mockup */}
                <div className="lg:col-span-7 space-y-8">
                    <div className="relative bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden aspect-[4/3]">
                        {/* Browser Chrome */}
                        <div className="bg-slate-50 h-10 border-b border-slate-200 flex items-center px-4 gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                            </div>
                            <div className="ml-4 h-6 flex-1 bg-white rounded-md border border-slate-200 px-3 flex items-center truncate">
                                <span className="text-[10px] text-slate-400">https://<span className="text-slate-900 font-bold">Your_Domain.brokerage.com</span>/mlslisting/id=123456</span>
                            </div>
                        </div>

                        <div className="p-8 space-y-8 relative h-full flex flex-col">
                            {/* Co-Branding Header Mockup */}
                            <div className="flex items-center gap-4">
                                <div className="w-48 py-2.5 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/30 flex items-center justify-center gap-3 relative group">
                                    <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white text-[10px] font-black">ZY</div>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600">Your Logo</span>

                                    {/* Callout 2 */}
                                    <div className="absolute -bottom-24 left-0 w-64 bg-white p-4 rounded-xl shadow-xl border border-slate-200 z-10 animate-in slide-in-from-top-2 duration-500">
                                        <div className="text-[10px] font-black text-indigo-600 uppercase mb-2">2. Logo Placement and Size</div>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                            You or your customer's logo and the broker of record partner's logo to be placed at the top left of the screen. These logos must be the same size. Logo cannot be bigger than the broker partner's logo.
                                        </p>
                                    </div>
                                </div>
                                <div className="w-48 py-2.5 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center gap-3">
                                    <i className="fa-solid fa-handshake text-slate-400"></i>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Partner Logo</span>
                                </div>
                            </div>

                            {/* Property Showcase Mockup */}
                            <div className="space-y-4 opacity-40 grayscale flex-1">
                                <div className="w-full h-48 bg-slate-100 rounded-2xl"></div>
                                <div className="grid grid-cols-4 gap-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="space-y-2">
                                            <div className="aspect-video bg-slate-100 rounded-lg relative">
                                                {/* Callout 3 Point */}
                                                {i === 2 && (
                                                    <div className="absolute -right-4 top-1/2 w-4 h-[2px] bg-indigo-500"></div>
                                                )}
                                            </div>
                                            <div className="h-2 w-3/4 bg-slate-200 rounded"></div>
                                            <div className="h-2 w-1/2 bg-slate-200 rounded"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Callout 3 */}
                            <div className="absolute top-1/2 right-8 w-72 bg-white p-5 rounded-2xl shadow-2xl border border-indigo-100 z-10 animate-in slide-in-from-right-4 duration-500">
                                <div className="text-[10px] font-black text-indigo-600 uppercase mb-2">3. Listing Agent and Brokerage Attribution</div>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                    Anywhere that a listing is displayed, including just a sliding rail on Listing Details Page (LDP), the listing agent and brokerage must be listing below the property.
                                </p>
                            </div>

                            {/* Callout 1 */}
                            <div className="absolute top-12 right-8 w-80 bg-slate-900 p-6 rounded-[2rem] text-white shadow-2xl border border-white/10 z-10 animate-in fade-in zoom-in-95 duration-700">
                                <div className="text-[10px] font-black text-indigo-400 uppercase mb-3">1. Login Signup gated / Subdomain</div>
                                <p className="text-[11px] font-medium leading-[1.8] opacity-80">
                                    Public web pages presenting MLS search & data to external users need to utilise a subdomain (<span className="text-white font-bold">.brokerage.com ending</span>) to prove BOR control. We're able to set up these subdomains DNS records to still point or redirect to your code without noticeable changes to your users' journey.
                                </p>
                                <p className="text-[11px] font-medium leading-[1.8] opacity-80 mt-2">
                                    Because of this in imperative to design your pages to ensure proper SEO and other attributions. It's best practice to have MLS search & data pages as interior pages.
                                </p>
                            </div>

                            {/* Footer Mockup */}
                            <div className="mt-auto pt-6 border-t border-slate-100 space-y-4">
                                <div className="flex justify-center flex-wrap gap-4 opacity-30 grayscale scale-75">
                                    <img src="https://armls.com/wp-content/uploads/2016/10/ARMLS-Logo-Small.png" alt="ARMLS" className="h-4" />
                                </div>
                                <div className="text-[8px] text-slate-300 font-medium text-center space-y-1">
                                    <p>This is just an example of an MLS listing and is provided for demonstration purposes only. The actual disclaimer, along with complete and accurate listing data, will be available through the MLS API.</p>
                                    <p>© Copyright 2025 Brokerage_partner.com. All rights reserved. Brokerage, Inc. d/b/a Broker.com d/b/a Brokerage.com (Example Broker ID/License), 123 Main St.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Strategic Pillars of Compliance */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm hover:border-indigo-200 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-3">Subdomain Control</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Automatic routing of search traffic through compliant subdomains while maintaining your core brand domain for non-MLS pages.
                    </p>
                </div>
                <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm hover:border-indigo-200 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <i className="fa-solid fa-code-branch text-xl"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-3">Dynamic Attribution</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Per-listing attribution engine that automatically injects relevant agent and brokerage credentials into the UI layer.
                    </p>
                </div>
                <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm hover:border-indigo-200 transition-all group">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <i className="fa-solid fa-scale-balanced text-xl"></i>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 mb-3">BOR Governance</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Partnering with National Brokerages to provide the legal framework (BOR) necessary for deep MLS data integration.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PremiumMLSTab;
