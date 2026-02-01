import React from 'react';

const ListingMarketingSection: React.FC = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Listing Marketing Standards</h2>
                <p className="text-lg text-slate-500 font-medium">High-impact strategies for property presentation and exposure.</p>
            </div>


            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 mb-8">
                <p className="text-indigo-800 leading-relaxed font-medium">
                    Selling a home successfully requires more than putting a sign in the yard. A well-prepared listing, high-quality marketing, and strategic presentation can maximize exposure, attract qualified buyers, and increase sale price.
                </p>
            </div>

            <div className="space-y-12">
                {/* 1. Preparing for MLS */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <span className="font-bold text-lg">1</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Preparing a Listing for MLS</h3>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
                        <h4 className="font-bold text-slate-900 mb-4">Checklist for MLS Preparation</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                'Complete all required fields accurately',
                                'Include accurate property descriptions',
                                'Verify school districts & zoning',
                                'Ensure photos are high-quality & current',
                                'Use keywords naturally in title/description'
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <i className="fa-regular fa-square-check mt-1 text-emerald-500"></i>
                                    <span className="text-slate-600 text-sm">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. Listing Checklist */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                            <span className="font-bold text-lg">2</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Real Estate Listing Checklist</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { icon: 'fa-table-list', title: 'Property Details', text: 'All facts accurate & verifiable.' },
                            { icon: 'fa-camera', title: 'High-Quality Photos', text: '15-25 staged professional images.' },
                            { icon: 'fa-video', title: 'Virtual Tours', text: '360° walkthroughs for remote buyers.' },
                            { icon: 'fa-pen-nib', title: 'Compelling Description', text: 'Storytelling + facts + lifestyle.' },
                            { icon: 'fa-tag', title: 'Accurate Pricing', text: 'Justify with comps/trends.' },
                            { icon: 'fa-door-open', title: 'Showing Notes', text: 'Instructions for agents.' },
                            { icon: 'fa-link', title: 'Lead Capture', text: 'Contact forms or CTA links.' },
                        ].map((item, i) => (
                            <div key={i} className="p-4 border border-slate-100 rounded-xl hover:shadow-md transition-shadow">
                                <i className={`fa-solid ${item.icon} text-indigo-500 text-xl mb-2`}></i>
                                <div className="font-bold text-slate-900 mb-1">{item.title}</div>
                                <div className="text-xs text-slate-500">{item.text}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Photo & Video Standards */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                            <span className="font-bold text-lg">3</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Photo & Video Standards</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-bold text-slate-900 mb-3 border-b pb-2">Photo Best Practices</h4>
                            <ul className="space-y-3">
                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-rose-500">Do:</span> Use professional wide-angle lenses.</li>
                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-rose-500">Do:</span> Stage rooms to maximize space.</li>
                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-rose-500">Do:</span> Shoot with natural light.</li>
                                <li className="flex gap-3 text-sm text-slate-600"><span className="font-bold text-rose-500">Do:</span> Capture exterior & neighborhood views.</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-3 border-b pb-2">Video & Virtual</h4>
                            <ul className="space-y-3">
                                <li className="flex gap-3 text-sm text-slate-600"><i className="fa-solid fa-check text-rose-500 mt-1"></i> Short walkthroughs (~1-2 mins).</li>
                                <li className="flex gap-3 text-sm text-slate-600"><i className="fa-solid fa-check text-rose-500 mt-1"></i> Drone footage for unique lots.</li>
                                <li className="flex gap-3 text-sm text-slate-600"><i className="fa-solid fa-check text-rose-500 mt-1"></i> Virtual tours for remote exploration.</li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-6 text-sm text-slate-500 italic bg-rose-50 p-3 rounded-lg border border-rose-100">
                        Tip: Avoid blurry, cluttered, or dark images — they reduce trust immediately.
                    </div>
                </div>

                {/* 4. Writing Descriptions */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                            <span className="font-bold text-lg">4</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Writing Effective Descriptions</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <h5 className="font-black text-xs uppercase tracking-wider text-slate-500 mb-2">Structure</h5>
                                <div className="space-y-2">
                                    <div><span className="font-bold text-slate-900 text-sm">Opening Hook:</span> <span className="text-slate-600 text-sm">Start with the strongest feature.</span></div>
                                    <div><span className="font-bold text-slate-900 text-sm">Core Details:</span> <span className="text-slate-600 text-sm">Sq ft, layout, upgrades.</span></div>
                                    <div><span className="font-bold text-slate-900 text-sm">Lifestyle:</span> <span className="text-slate-600 text-sm">Schools, commute, community.</span></div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <h5 className="font-black text-xs uppercase tracking-wider text-slate-500 mb-2">Avoid</h5>
                                <p className="text-slate-600 text-sm">Overused phrases like “charming” or “needs TLC” unless paired with specific details.</p>
                            </div>
                        </div>
                        <div className="bg-amber-50 p-5 rounded-xl border border-amber-100 relative">
                            <div className="absolute -top-3 -right-3 bg-white text-amber-600 px-3 py-1 rounded-full shadow-sm text-xs font-bold border border-amber-200">Example</div>
                            <p className="font-serif italic text-amber-900 text-lg leading-relaxed">
                                "Wake up to panoramic lake views in this 3-bedroom, 2-bath home..."
                            </p>
                        </div>
                    </div>
                </div>

                {/* 5. Optimization & Mistakes */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><span className="font-bold">5</span></div>
                            <h3 className="font-bold text-slate-900">MLS Optimization</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                            <li>Fill all mandatory & optional fields.</li>
                            <li>Add high-quality multimedia (ranks higher).</li>
                            <li>Use targeted keywords in title/description.</li>
                            <li>Tag accurate categories (style, school).</li>
                            <li>Update regularly (price/status changes).</li>
                        </ul>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center"><span className="font-bold">6</span></div>
                            <h3 className="font-bold text-slate-900">Common Mistakes</h3>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
                            <li>Poor Photography (dark/blurry).</li>
                            <li>Inaccurate/Incomplete Data.</li>
                            <li>Overpriced Listings (stagnation).</li>
                            <li>Generic Descriptions (clichés).</li>
                            <li>Ignoring Online Presentation.</li>
                        </ul>
                    </div>
                </div>

                {/* Bonus Marketing Tips */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 rounded-2xl text-white shadow-lg">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-star"></i> Bonus Marketing Tips
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
                            <div className="font-bold mb-1">Social Campaigns</div>
                            <div className="text-sm opacity-90">Target local buyers with paid/organic posts.</div>
                        </div>
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
                            <div className="font-bold mb-1">Email Newsletters</div>
                            <div className="text-sm opacity-90">Highlight new listings to your network.</div>
                        </div>
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
                            <div className="font-bold mb-1">Digital Flyers</div>
                            <div className="text-sm opacity-90">Offer downloadable brochures for serious buyers.</div>
                        </div>
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition-colors">
                            <div className="font-bold mb-1">Virtual Open House</div>
                            <div className="text-sm opacity-90">Host online events for wider reach.</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SEO Checklist */}
            <div className="bg-slate-900 text-white p-8 rounded-3xl mt-12 shadow-2xl">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-xl">
                        <i className="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black tracking-tight">Quick SEO Checklist</h3>
                        <p className="text-emerald-200">For Maximum Visibility</p>
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                    {[
                        'Fill all MLS fields accurately',
                        'Include 15–25 high-quality photos + video',
                        'Use natural keywords in title & description',
                        'Highlight unique features & lifestyle benefits',
                        'Avoid clichés and generic phrasing',
                        'Update listing as necessary',
                        'Share listing across all channels'
                    ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center flex-shrink-0">
                                <i className="fa-solid fa-check text-[10px] text-emerald-400"></i>
                            </div>
                            <span className="text-sm font-medium text-slate-300">{item}</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default ListingMarketingSection;
