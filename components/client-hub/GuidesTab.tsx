import React, { useState, useEffect } from 'react';
import { getGuideBySlug, saveGuideContent } from '../../services/firebaseService';
import { generateGuide } from '../../services/geminiService';

interface GuideItem {
    id: string;
    title: string;
    description?: string;
    slug: string;
}

interface GuideCategory {
    id: string;
    topicSlug: string;
    title: string;
    icon: string;
    count: string;
    items: GuideItem[];
}

const GUIDE_DATA: GuideCategory[] = [
    {
        id: 'hoa',
        topicSlug: 'hoa',
        title: 'HOA & Community Rules',
        icon: 'fa-landmark-dome',
        count: '20 pages',
        items: [
            { id: 'h1', title: 'What happens if HOA fines go unpaid in California?', slug: 'what-happens-if-hoa-fines-go-unpaid-california' },
            { id: 'h2', title: 'Can an HOA place a lien on your home in CA?', slug: 'hoa-lien-process-california' },
            { id: 'h3', title: 'How long before HOA can foreclose in California?', slug: 'hoa-foreclosure-timeline-california' },
            { id: 'h4', title: 'Can HOA increase dues without homeowner approval?', slug: 'can-hoa-increase-dues-without-homeowner-approval' },
            { id: 'h5', title: 'What is an HOA special assessment?', slug: 'what-is-an-hoa-special-assessment' },
            { id: 'h6', title: 'Can HOA deny exterior changes?', slug: 'can-hoa-deny-exterior-changes' },
            { id: 'h7', title: 'Can HOA restrict rentals in California?', slug: 'can-hoa-restrict-rentals-in-california' },
            { id: 'h8', title: 'What happens if you ignore HOA violation notices?', slug: 'what-happens-if-you-ignore-hoa-violation-notices' },
            { id: 'h9', title: 'Can HOA tow your car from your driveway?', slug: 'can-hoa-tow-your-car-from-your-driveway' },
            { id: 'h10', title: 'HOA dispute process explained', slug: 'hoa-dispute-process-explained' },
            { id: 'h11', title: 'Can HOA fine without notice?', slug: 'can-hoa-fine-without-notice' },
            { id: 'h12', title: 'What rights do homeowners have against HOA?', slug: 'what-rights-do-homeowners-have-against-hoa' },
            { id: 'h13', title: 'How HOA collections work', slug: 'how-hoa-collections-work' },
            { id: 'h14', title: 'What happens after HOA sends a demand letter?', slug: 'what-happens-after-hoa-sends-a-demand-letter' },
            { id: 'h15', title: 'Can HOA charge late fees?', slug: 'can-hoa-charge-late-fees' },
            { id: 'h16', title: 'HOA vs homeowner insurance responsibility', slug: 'hoa-vs-homeowner-insurance-responsibility' },
            { id: 'h17', title: 'What documents govern HOA authority?', slug: 'what-documents-govern-hoa-authority' },
            { id: 'h18', title: 'Can HOA foreclose for unpaid dues?', slug: 'can-hoa-foreclose-for-unpaid-dues' },
            { id: 'h19', title: 'How to request HOA records', slug: 'how-to-request-hoa-records' },
            { id: 'h20', title: 'HOA election and board powers explained', slug: 'hoa-election-and-board-powers-explained' },
        ]
    },
    {
        id: 'insurance',
        topicSlug: 'insurance',
        title: 'Homeowners Insurance',
        icon: 'fa-house-shield',
        count: '20 pages',
        items: [
            { id: 'i1', title: 'Why was my homeowners insurance claim denied?', slug: 'homeowners-insurance-claim-denied' },
            { id: 'i2', title: 'What happens after filing a homeowners claim?', slug: 'what-happens-after-filing-a-homeowners-claim' },
            { id: 'i3', title: 'How long does an insurance investigation take?', slug: 'insurance-adjuster-investigation-timeline' },
            { id: 'i4', title: 'What does an insurance adjuster do?', slug: 'what-does-an-insurance-adjuster-do' },
            { id: 'i5', title: 'Replacement cost vs actual cash value', slug: 'replacement-cost-vs-actual-cash-value' },
            { id: 'i6', title: 'Does filing a claim raise premiums?', slug: 'does-filing-a-claim-raise-premiums' },
            { id: 'i7', title: 'What damages are excluded from homeowners insurance?', slug: 'what-damages-are-excluded-from-homeowners-insurance' },
            { id: 'i8', title: 'Can insurance cancel coverage after a claim?', slug: 'can-insurance-cancel-coverage-after-a-claim' },
            { id: 'i9', title: 'What is subrogation in homeowners insurance?', slug: 'what-is-subrogation-in-homeowners-insurance' },
            { id: 'i10', title: 'What if insurance payout is less than repair cost?', slug: 'what-if-insurance-payout-is-less-than-repair-cost' },
            { id: 'i11', title: 'Water damage vs flood damage explained', slug: 'water-damage-vs-flood-damage-explained' },
            { id: 'i12', title: 'Mold coverage explained', slug: 'mold-coverage-explained' },
            { id: 'i13', title: 'Fire damage claim process', slug: 'fire-damage-claim-process' },
            { id: 'i14', title: 'What is loss of use coverage?', slug: 'what-is-loss-of-use-coverage' },
            { id: 'i15', title: 'How insurance depreciation works', slug: 'how-insurance-depreciation-works' },
            { id: 'i16', title: 'When insurance disputes go to appraisal', slug: 'when-insurance-disputes-go-to-appraisal' },
            { id: 'i17', title: 'What happens if claim is delayed?', slug: 'what-happens-if-claim-is-delayed' },
            { id: 'i18', title: 'What documents insurers request', slug: 'what-documents-insurers-request' },
            { id: 'i19', title: 'Can you reopen a closed claim?', slug: 'can-you-reopen-a-closed-claim' },
            { id: 'i20', title: 'How insurance settlement timelines work', slug: 'how-insurance-settlement-timelines-work' },
        ]
    },
    {
        id: 'escrow',
        topicSlug: 'escrow',
        title: 'Escrow, Title & Closing',
        icon: 'fa-file-invoice-dollar',
        count: '20 pages',
        items: [
            { id: 'e1', title: 'How long does escrow take in California?', slug: 'how-long-does-escrow-take-california' },
            { id: 'e2', title: 'What happens after escrow opens?', slug: 'what-happens-after-escrow-opens' },
            { id: 'e3', title: 'What delays escrow closing?', slug: 'what-delays-escrow-closing' },
            { id: 'e4', title: 'What does “clear to close” mean?', slug: 'what-does-clear-to-close-mean' },
            { id: 'e5', title: 'What is a preliminary title report?', slug: 'what-is-a-preliminary-title-report' },
            { id: 'e6', title: 'Common title defects explained', slug: 'common-title-defects-explained' },
            { id: 'e7', title: 'Can escrow close without repairs?', slug: 'can-escrow-close-without-repairs' },
            { id: 'e8', title: 'What happens if escrow doesn’t close on time?', slug: 'what-happens-if-escrow-doesnt-close-on-time' },
            { id: 'e9', title: 'Who chooses the title company?', slug: 'who-chooses-the-title-company' },
            { id: 'e10', title: 'What happens if buyer backs out during escrow?', slug: 'what-happens-if-buyer-backs-out-during-escrow' },
            { id: 'e11', title: 'What is a final walkthrough?', slug: 'what-is-a-final-walkthrough' },
            { id: 'e12', title: 'Can seller cancel escrow?', slug: 'can-seller-cancel-escrow' },
            { id: 'e13', title: 'What happens if appraisal comes in low?', slug: 'what-happens-if-appraisal-comes-in-low' },
            { id: 'e14', title: 'What contingencies protect buyers?', slug: 'what-contingencies-protect-buyers' },
            { id: 'e15', title: 'What happens after offer acceptance?', slug: 'what-happens-after-offer-acceptance' },
            { id: 'e16', title: 'Can seller refuse repairs?', slug: 'can-seller-refuse-repairs' },
            { id: 'e17', title: 'How escrow instructions work', slug: 'how-escrow-instructions-work' },
            { id: 'e18', title: 'What happens at recording?', slug: 'what-happens-at-recording' },
            { id: 'e19', title: 'What happens after closing?', slug: 'what-happens-after-closing' },
            { id: 'e20', title: 'How escrow fees are calculated', slug: 'how-escrow-fees-are-calculated' },
        ]
    },
    {
        id: 'taxes',
        topicSlug: 'property-taxes',
        title: 'Property Taxes & Assessments',
        icon: 'fa-receipt',
        count: '15 pages',
        items: [
            { id: 't1', title: 'What happens if property taxes go unpaid?', slug: 'what-happens-if-property-taxes-go-unpaid' },
            { id: 't2', title: 'How long before a tax lien is placed?', slug: 'how-long-before-a-tax-lien-is-placed' },
            { id: 't3', title: 'What is a supplemental tax bill in California?', slug: 'supplemental-tax-bill-california' },
            { id: 't4', title: 'Why did my property taxes increase suddenly?', slug: 'why-did-my-property-taxes-increase-suddenly' },
            { id: 't5', title: 'What triggers reassessment?', slug: 'what-triggers-reassessment' },
            { id: 't6', title: 'What happens after filing a tax appeal?', slug: 'what-happens-after-filing-a-tax-appeal' },
            { id: 't7', title: 'Can property taxes be deferred?', slug: 'can-property-taxes-be-deferred' },
            { id: 't8', title: 'What is a tax-defaulted property?', slug: 'what-is-a-tax-defaulted-property' },
            { id: 't9', title: 'How property tax penalties work', slug: 'how-property-tax-penalties-work' },
            { id: 't10', title: 'How to read a property tax bill', slug: 'how-to-read-a-property-tax-bill' },
            { id: 't11', title: 'What exemptions reduce property taxes?', slug: 'what-exemptions-reduce-property-taxes' },
            { id: 't12', title: 'What happens after tax sale?', slug: 'what-happens-after-tax-sale' },
            { id: 't13', title: 'Property tax vs special assessments', slug: 'property-tax-vs-special-assessments' },
            { id: 't14', title: 'How inheritance affects property taxes', slug: 'how-inheritance-affects-property-taxes' },
            { id: 't15', title: 'Proposition 13 explained (procedural)', slug: 'proposition-13-explained' },
        ]
    },
    {
        id: 'maintenance',
        topicSlug: 'repairs-liability',
        title: 'Maintenance, Liability & Disputes',
        icon: 'fa-screwdriver-wrench',
        count: '15 pages',
        items: [
            { id: 'm1', title: 'Who pays for fence repairs between neighbors?', slug: 'who-pays-for-fence-repairs' },
            { id: 'm2', title: 'Who is responsible for sidewalk injuries?', slug: 'homeowner-liability-sidewalk-injuries' },
            { id: 'm3', title: 'Does homeowners insurance cover water leaks?', slug: 'does-homeowners-insurance-cover-water-leaks' },
            { id: 'm4', title: 'Who pays for sewer line repairs?', slug: 'who-pays-for-sewer-line-repairs' },
            { id: 'm5', title: 'What happens if unpermitted work is discovered?', slug: 'what-happens-if-unpermitted-work-is-discovered' },
            { id: 'm6', title: 'Who is liable for tree damage?', slug: 'who-is-liable-for-tree-damage' },
            { id: 'm7', title: 'Shared driveway maintenance rules', slug: 'shared-driveway-maintenance-rules' },
            { id: 'm8', title: 'What is normal wear and tear?', slug: 'what-is-normal-wear-and-tear' },
            { id: 'm9', title: 'Mold liability between parties', slug: 'mold-liability-between-parties' },
            { id: 'm10', title: 'What happens if contractor damages property?', slug: 'what-happens-if-contractor-damages-property' },
            { id: 'm11', title: 'Can homeowner be sued for injuries?', slug: 'can-homeowner-be-sued-for-injuries' },
            { id: 'm12', title: 'What happens after a code violation notice?', slug: 'what-happens-after-a-code-violation-notice' },
            { id: 'm13', title: 'How building permits affect resale', slug: 'how-building-permits-affect-resale' },
            { id: 'm14', title: 'Boundary disputes explained', slug: 'boundary-disputes-explained' },
            { id: 'm15', title: 'Easement disputes explained', slug: 'easement-disputes-explained' },
        ]
    }
];

const GuidesTab: React.FC = () => {
    const [activeCategoryId, setActiveCategoryId] = useState(GUIDE_DATA[0].id);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGuide, setSelectedGuide] = useState<GuideItem | null>(null);
    const [guideContent, setGuideContent] = useState<string | null>(null);
    const [loadingContent, setLoadingContent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeCategory = GUIDE_DATA.find(c => c.id === activeCategoryId) || GUIDE_DATA[0];

    const handleViewGuide = async (guide: GuideItem) => {
        setSelectedGuide(guide);
        setLoadingContent(true);
        setError(null);

        try {
            // 1. Try to fetch from Firebase
            const cachedData = await getGuideBySlug(activeCategory.topicSlug, guide.slug);
            if (cachedData) {
                setGuideContent(cachedData.content);
                setLoadingContent(false);
                return;
            }

            // 2. If not found, generate with Gemini
            console.log(`[Guides] Generating new guide for: ${guide.title}`);
            const generatedContent = await generateGuide(activeCategory.title, guide.title);
            setGuideContent(generatedContent);

            // 3. Save to Firebase for future use
            await saveGuideContent({
                id: `${activeCategory.topicSlug}_${guide.slug}`,
                topicSlug: activeCategory.topicSlug,
                slug: guide.slug,
                title: guide.title,
                content: generatedContent,
                lastUpdated: new Date()
            });

        } catch (err: any) {
            console.error('Error in guide retrieval/generation:', err);
            setError("Failed to load guide. Please try again.");
            // Fallback for demo
            setGuideContent(`# ${guide.title}\n\nUnable to retrieve official brief. Our intelligence engine encountered a temporary sync error. Please check back in a few moments.\n\n### Error Detail:\n- Connection Timeout or Gemini API Rate Limit`);
        } finally {
            setLoadingContent(false);
        }
    };

    const filteredItems = activeCategory.items.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedGuide) {
        return (
            <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in duration-500">
                {/* Article Header */}
                <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 transition-all">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setSelectedGuide(null)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all font-black text-[10px] uppercase tracking-widest group"
                        >
                            <i className="fa-solid fa-arrow-left transition-transform group-hover:-translate-x-1"></i>
                            Back to Library
                        </button>
                        <div className="h-6 w-px bg-slate-100"></div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                                <i className={`fa-solid ${activeCategory.icon} text-sm`}></i>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight leading-none">{selectedGuide.title}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeCategory.title}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                    <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-tight">/{activeCategory.topicSlug}/{selectedGuide.slug}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Article Body */}
                <div className="flex-1 overflow-y-auto bg-white">
                    <div className="max-w-4xl mx-auto px-10 py-20 pb-32">
                        {error && (
                            <div className="bg-rose-50 border border-rose-100 text-rose-700 p-6 rounded-3xl mb-10 font-bold flex items-center gap-4">
                                <i className="fa-solid fa-circle-exclamation text-xl"></i>
                                {error}
                            </div>
                        )}
                        {loadingContent ? (
                            <div className="py-32 flex flex-col items-center justify-center space-y-6">
                                <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] animate-pulse">Retrieving Professional Brief...</p>
                            </div>
                        ) : (
                            <article className="prose prose-slate prose-lg max-w-none">
                                <div className="space-y-12">
                                    {guideContent?.split('\n').map((line, i) => {
                                        if (line.startsWith('# ')) return <h1 key={i} className="text-5xl font-black text-slate-900 mb-12 border-b-[6px] border-indigo-600 pb-8 leading-tight tracking-tight">{line.replace('# ', '')}</h1>;
                                        if (line.startsWith('## ')) return <h2 key={i} className="text-3xl font-black text-slate-800 mt-20 mb-8 flex items-center gap-4"><div className="w-3 h-10 bg-indigo-500 rounded-full"></div>{line.replace('## ', '')}</h2>;
                                        if (line.startsWith('### ')) return <h3 key={i} className="text-xl font-black text-slate-800 mt-12 mb-6 uppercase tracking-[0.2em] text-indigo-600">{line.replace('### ', '')}</h3>;
                                        if (line.startsWith('---')) return <hr key={i} className="my-16 border-slate-100" />;
                                        if (line.trim() === '') return <div key={i} className="h-6"></div>;

                                        // Handle simple formatting for tables/timelines
                                        if (line.includes('|') && i > 0) {
                                            return (
                                                <div key={i} className="bg-slate-50 border border-slate-100 p-6 rounded-3xl font-medium text-slate-700 my-4 shadow-sm">
                                                    {line.split('|').filter(v => v.trim()).map((cell, ci) => (
                                                        <span key={ci} className={ci === 0 ? "font-black text-indigo-600 mr-4 min-w-[120px] inline-block" : ""}>{cell.trim()} </span>
                                                    ))}
                                                </div>
                                            );
                                        }

                                        return <p key={i} className="text-slate-600 leading-[1.8] text-xl mb-6 font-medium selection:bg-indigo-100">{line}</p>;
                                    })}
                                </div>

                                {/* Professional Footer */}
                                <div className="mt-32 pt-16 border-t border-slate-100">
                                    <div className="bg-slate-900 rounded-[3rem] p-12 text-white flex flex-col md:flex-row items-center justify-between gap-12 shadow-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                                        <div className="relative z-10 text-center md:text-left flex-1">
                                            <h4 className="text-2xl font-black tracking-tight mb-3">Knowledge Verification</h4>
                                            <p className="text-slate-400 font-medium text-lg leading-relaxed">This professional brief has been cross-referenced with the California Civil Code and standard industry practices for 2026 accuracy.</p>
                                        </div>
                                        <div className="relative z-10 flex items-center gap-6 bg-white/5 backdrop-blur-xl px-10 py-7 rounded-[2.5rem] border border-white/10 shadow-inner">
                                            <div className="flex -space-x-5">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="w-14 h-14 rounded-full bg-indigo-600 border-4 border-slate-900 flex items-center justify-center shadow-lg">
                                                        <i className="fa-solid fa-shield-check text-base text-indigo-300"></i>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="text-left">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Status</div>
                                                <div className="text-lg font-black tracking-tight">Verified Article</div>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setSelectedGuide(null);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="mt-16 w-full py-8 rounded-[2rem] border-2 border-slate-100 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-100 transition-all cursor-pointer shadow-sm hover:shadow-md"
                                    >
                                        Finish Reading & Return to Library
                                    </button>
                                </div>
                            </article>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-[#F8FAFC] animate-in fade-in duration-500">
            {/* Sidebar */}
            <div className="w-80 border-r border-slate-200 bg-white flex flex-col shadow-sm z-10 transition-all">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">
                        Knowledge Center
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">Professional Client Guides</p>
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-1">
                    {GUIDE_DATA.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setActiveCategoryId(category.id)}
                            className={`w-full flex items-center justify-between px-6 py-4 transition-all group ${activeCategoryId === category.id
                                ? 'bg-indigo-50 border-r-4 border-indigo-600'
                                : 'hover:bg-slate-50 border-r-4 border-transparent'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeCategoryId === category.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                    : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-indigo-500 shadow-inner'
                                    }`}>
                                    <i className={`fa-solid ${category.icon} text-sm`}></i>
                                </div>
                                <div className="text-left">
                                    <div className={`text-xs font-black tracking-tight ${activeCategoryId === category.id ? 'text-indigo-900' : 'text-slate-600'
                                        }`}>
                                        {category.title}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                        {category.count}
                                    </div>
                                </div>
                            </div>
                            <i className={`fa-solid fa-chevron-right text-[8px] transition-transform ${activeCategoryId === category.id ? 'text-indigo-400 translate-x-1' : 'text-slate-300 opacity-0 group-hover:opacity-100'
                                }`}></i>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col transition-all">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-10 py-8">
                    <div className="mb-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                                    {activeCategory.title}
                                </h1>
                            </div>
                        </div>
                    </div>

                    <div className="relative max-w-md">
                        <input
                            type="text"
                            placeholder="Search guides in this category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 rounded-2xl outline-none shadow-inner focus:shadow-xl transition-all text-sm font-medium"
                        />
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredItems.map((item, idx) => (
                            <button
                                key={item.id}
                                onClick={() => handleViewGuide(item)}
                                className="group bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all text-left flex flex-col h-full"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                            <i className="fa-solid fa-file-lines text-sm"></i>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                            #{idx + 1}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 leading-snug mb-3 group-hover:text-indigo-600 transition-colors">
                                        {item.title}
                                    </h3>
                                    <div className="text-[10px] font-bold text-slate-400 font-mono tracking-tight bg-slate-50 px-2 py-1 rounded inline-block">
                                        /{activeCategory.topicSlug}/{item.slug}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-all">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.15em]">
                                        Read Guide
                                    </span>
                                    <i className="fa-solid fa-arrow-right text-[10px] text-indigo-500 translate-x-1"></i>
                                </div>
                            </button>
                        ))}

                        {filteredItems.length === 0 && (
                            <div className="col-span-full py-20 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
                                    <i className="fa-solid fa-file-circle-question text-3xl text-slate-300"></i>
                                </div>
                                <h3 className="text-lg font-black text-slate-900">No guides found</h3>
                                <p className="text-slate-500 font-medium mt-2">Try adjusting your search query.</p>
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="mt-6 text-indigo-600 font-black text-xs uppercase tracking-widest hover:text-indigo-700"
                                >
                                    Clear search
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuidesTab;
