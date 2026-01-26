import React, { useState, useEffect } from 'react';
import { getGuideBySlug, saveGuideContent } from '../../services/firebaseService';
import { generateGuide, generateGuideImage } from '../../services/geminiService';
import { GuideResult } from '../../prompts/guideGeneration';

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
            { id: 'h1', title: 'What happens if HOA fines go unpaid in California?', slug: 'what-happens-if-hoa-fines-go-unpaid-california', description: 'When HOA fines remain unpaid, the association may pursue several collection methods. In California, this can lead to late fees, personal lawsuits, or even property liens.' },
            { id: 'h2', title: 'Can an HOA place a lien on your home in CA?', slug: 'hoa-lien-process-california', description: 'California law allows HOAs to record a lien against a property for delinquent assessments. This secured interest must follow strict notification and procedural requirements under the Davis-Stirling Act.' },
            { id: 'h3', title: 'How long before HOA can foreclose in California?', slug: 'hoa-foreclosure-timeline-california', description: 'The foreclosure process is strictly regulated and cannot begin until thresholds are met. Associations must typically wait until debt reaches $1,800 or remains unpaid for 12 months.' },
            { id: 'h4', title: 'Can HOA increase dues without homeowner approval?', slug: 'can-hoa-increase-dues-without-homeowner-approval', description: 'HOA boards generally possess the authority to increase regular assessments by up to 20% annually without a member vote. Larger increases or special assessments typically require homeowner approval.' },
            { id: 'h5', title: 'What is an HOA special assessment?', slug: 'what-is-an-hoa-special-assessment', description: 'A special assessment is a one-time fee levied for major repairs or unexpected community expenses. These charges are often necessary when reserve funds are insufficient for critical infrastructure updates.' },
            { id: 'h6', title: 'Can HOA deny exterior changes?', slug: 'can-hoa-deny-exterior-changes', description: 'Architectural control allows HOAs to regulate the aesthetic harmony of the community. Proposed modifications must generally comply with the specific guidelines outlined in the community governing documents.' },
            { id: 'h7', title: 'Can HOA restrict rentals in California?', slug: 'can-hoa-restrict-rentals-in-california', description: 'California law significantly limits the ability of HOAs to prohibit rentals. While some restrictions on short-term stays may exist, associations generally cannot ban long-term leasing of properties.' },
            { id: 'h8', title: 'What happens if you ignore HOA violation notices?', slug: 'what-happens-if-you-ignore-hoa-violation-notices', description: 'Ignoring architectural or conduct violations can lead to escalating fines and legal actions. Prompt communication and dispute resolution are essential to avoiding costly enforcement proceedings.' },
            { id: 'h9', title: 'Can HOA tow your car from your driveway?', slug: 'can-hoa-tow-your-car-from-your-driveway', description: 'Towing authority depends on whether the driveway is considered private or community property. California law requires specific signage and notification before an association can authorize vehicle removal.' },
            { id: 'h10', title: 'HOA dispute process explained', slug: 'hoa-dispute-process-explained', description: 'Internal Dispute Resolution (IDR) and Meet-and-Confer procedures offer non-judicial ways to settle conflicts. These steps are often required before either party can proceed to formal litigation or arbitration.' },

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
            { id: 'i1', title: 'Why was my homeowners insurance claim denied?', slug: 'homeowners-insurance-claim-denied', description: 'Claim denials often occur due to coverage exclusions, filing delays, or insufficient documentation. Understanding the specific reasons for denial is the first step in the appeals process.' },
            { id: 'i2', title: 'What happens after filing a homeowners claim?', slug: 'what-happens-after-filing-a-homeowners-claim', description: 'Once a claim is submitted, the insurer initiates an investigation to assess the damage. This process involves adjuster inspections, evidence gathering, and coverage determination.' },
            { id: 'i3', title: 'How long does an insurance investigation take?', slug: 'insurance-adjuster-investigation-timeline', description: 'California law sets specific timeframes for insurers to acknowledge, investigate, and decide on claims. Most standard investigations are completed within 40 to 60 days of submission.' },
            { id: 'i4', title: 'What does an insurance adjuster do?', slug: 'what-does-an-insurance-adjuster-do', description: 'Adjusters are responsible for evaluating the cause and extent of property damage. They act as the primary liaison between the homeowner and the insurance company during the claim lifecycle.' },
            { id: 'i5', title: 'Replacement cost vs actual cash value', slug: 'replacement-cost-vs-actual-cash-value', description: 'Replacement cost covers the full price of new items, while actual cash value factors in depreciation. Choosing the right coverage type significantly impacts your final settlement amount.' },
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
            { id: 'e1', title: 'How long does escrow take in California?', slug: 'how-long-does-escrow-take-california', description: 'The typical escrow period in California ranges from 30 to 45 days. Timelines can vary based on loan processing, inspection findings, and the complexity of the title search.' },
            { id: 'e2', title: 'What happens after escrow opens?', slug: 'what-happens-after-escrow-opens', description: 'After opening, the escrow officer collects deposits, orders title reports, and coordinates between all parties. This stage initiates the formal due diligence and closing sequence.' },
            { id: 'e3', title: 'What delays escrow closing?', slug: 'what-delays-escrow-closing', description: 'Common delays include financing issues, unexpected title clouds, or unresolved repair requests. Proactive communication and timely document submission are key to staying on schedule.' },
            { id: 'e4', title: 'What does “clear to close” mean?', slug: 'what-does-clear-to-close-mean', description: 'Receiving a "clear to close" status means the lender has finalized all underwriting requirements. This is the final milestone before signing closing documents and transferring funds.' },
            { id: 'e5', title: 'What is a preliminary title report?', slug: 'what-is-a-preliminary-title-report', description: 'This report details the property ownership history and any existing liens or encumbrances. It is a vital document for identifying potential legal hurdles before the sale is finalized.' },
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

interface GuidesTabProps {
    onNavigate?: (view: any, path: string) => void;
}

const GuidesTab: React.FC<GuidesTabProps> = ({ onNavigate }) => {
    const [activeCategoryId, setActiveCategoryId] = useState(GUIDE_DATA[0].id);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGuide, setSelectedGuide] = useState<GuideItem | null>(null);
    const [guideContent, setGuideContent] = useState<GuideResult | string | null>(null);
    const [loadingContent, setLoadingContent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeCategory = GUIDE_DATA.find(c => c.id === activeCategoryId) || GUIDE_DATA[0];

    const handleViewGuide = async (guide: GuideItem, categoryOverride?: GuideCategory) => {
        const category = categoryOverride || activeCategory;
        setSelectedGuide(guide);
        setLoadingContent(true);
        setError(null);

        // Update URL
        const newPath = `/${category.topicSlug}/${guide.slug}`;
        if (onNavigate) {
            onNavigate('guides', newPath);
        } else if (window.location.pathname !== newPath) {
            window.history.pushState({ mode: 'guides' }, '', newPath);
        }

        try {
            // 1. Try to fetch from Firebase
            const cachedData = await getGuideBySlug(category.topicSlug, guide.slug);
            if (cachedData) {
                setGuideContent(cachedData.content);
                setLoadingContent(false);
                return;
            }

            // 2. If not found, generate content and image in parallel
            console.log(`[Guides] Generating new guide for: ${guide.title}`);

            const [generatedContent, heroImage] = await Promise.all([
                generateGuide(category.title, guide.title),
                generateGuideImage(category.title, guide.title, category.topicSlug, guide.slug).catch(err => {
                    console.warn('Hero image generation failed, continuing without image:', err);
                    return null;
                })
            ]);

            // Add the hero image to the content if generated
            const contentWithImage = heroImage ? { ...generatedContent, heroImage } : generatedContent;
            setGuideContent(contentWithImage);

            // 3. Save to Firebase for future use (with hero image if available)
            await saveGuideContent({
                id: `${category.topicSlug}_${guide.slug}`,
                topicSlug: category.topicSlug,
                slug: guide.slug,
                title: guide.title,
                content: contentWithImage,
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

    // Sync state with URL on initial load and popstate
    useEffect(() => {
        const syncWithUrl = () => {
            const path = window.location.pathname;
            const parts = path.split('/').filter(Boolean);
            const isRealtor = parts[0] === 'realtor';
            const subPath = isRealtor ? parts.slice(1) : parts;

            if (subPath.length === 2) {
                // topic/guide
                const topicSlug = subPath[0];
                const guideSlug = subPath[1];
                const category = GUIDE_DATA.find(c => c.topicSlug === topicSlug);
                if (category) {
                    setActiveCategoryId(category.id);
                    const guide = category.items.find(i => i.slug === guideSlug);
                    if (guide) {
                        handleViewGuide(guide, category);
                    }
                }
            } else if (subPath.length === 1 && !['guides', 'realtor'].includes(subPath[0])) {
                // topic
                const category = GUIDE_DATA.find(c => c.topicSlug === subPath[0]);
                if (category) {
                    setActiveCategoryId(category.id);
                    setSelectedGuide(null);
                }
            } else {
                setSelectedGuide(null);
            }
        };

        syncWithUrl();
        window.addEventListener('popstate', syncWithUrl);
        return () => window.removeEventListener('popstate', syncWithUrl);
    }, []);

    const handleCategoryChange = (catId: string) => {
        setActiveCategoryId(catId);
        setSelectedGuide(null);
        const category = GUIDE_DATA.find(c => c.id === catId);
        if (category) {
            const newPath = `/${category.topicSlug}`;
            if (onNavigate) {
                onNavigate('guides', newPath);
            } else if (window.location.pathname !== newPath) {
                window.history.pushState({ mode: 'guides' }, '', newPath);
            }
        }
    };

    const handleGoBack = () => {
        setSelectedGuide(null);
        const category = GUIDE_DATA.find(c => c.id === activeCategoryId);
        const newPath = category ? `/${category.topicSlug}` : '/guides';

        if (onNavigate) {
            onNavigate('guides', newPath);
        } else if (window.location.pathname !== newPath) {
            window.history.pushState({ mode: 'guides' }, '', newPath);
        }
    };

    const filteredItems = activeCategory.items.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedGuide) {
        return (
            <div className="flex-1 flex flex-col bg-white overflow-hidden animate-in fade-in duration-500">
                {/* Article Header */}
                <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-[73px] z-10 transition-all">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={handleGoBack}
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

                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Article Body */}
                <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                    <div className="max-w-5xl mx-auto px-10 py-12 pb-20">
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
                                {typeof guideContent === 'string' ? (
                                    <div className="space-y-12">
                                        {guideContent?.split('\n').map((line, i) => {
                                            if (line.startsWith('# ')) return <h1 key={i} className="text-4xl font-black text-slate-900 mb-8 border-b-[6px] border-indigo-600 pb-6 leading-tight tracking-tight">{line.replace('# ', '')}</h1>;
                                            if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-black text-slate-800 mt-12 mb-6 flex items-center gap-3"><div className="w-2.5 h-8 bg-indigo-500 rounded-full"></div>{line.replace('## ', '')}</h2>;
                                            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-black text-slate-800 mt-8 mb-4 uppercase tracking-[0.2em] text-indigo-600">{line.replace('### ', '')}</h3>;
                                            if (line.startsWith('---')) return <hr key={i} className="my-10 border-slate-100" />;
                                            if (line.trim() === '') return <div key={i} className="h-4"></div>;

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

                                            return <p key={i} className="text-slate-600 leading-[1.6] text-lg mb-4 font-medium selection:bg-indigo-100">{line}</p>;
                                        })}
                                    </div>
                                ) : guideContent && (
                                    <div className="space-y-16">
                                        <section className="max-w-3xl">
                                            <h1 className="text-2xl font-black text-slate-900 mb-6 border-l-4 border-indigo-600 pl-6 leading-tight tracking-tight">
                                                {guideContent.title}
                                            </h1>
                                            <p className="text-slate-600 leading-relaxed text-base font-semibold">
                                                {guideContent.introduction}
                                            </p>
                                        </section>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <section className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100/50">
                                                <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-3">
                                                    <i className="fa-solid fa-circle-info text-indigo-500 text-sm"></i>
                                                    {guideContent.whatThisMeans.title}
                                                </h2>
                                                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                                    {guideContent.whatThisMeans.content}
                                                </p>
                                            </section>
                                            <section className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100/50">
                                                <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-3">
                                                    <i className="fa-solid fa-circle-question text-indigo-500 text-sm"></i>
                                                    {guideContent.whyThisHappens.title}
                                                </h2>
                                                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                                    {guideContent.whyThisHappens.content}
                                                </p>
                                            </section>
                                        </div>

                                        <section>
                                            <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-3">
                                                <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                                                {guideContent.legalFramework.title}
                                            </h2>
                                            <p className="text-slate-600 leading-relaxed text-sm mb-6 max-w-3xl font-medium">
                                                {guideContent.legalFramework.context}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {guideContent.legalFramework.statutes.map((item, i) => {
                                                    const code = typeof item === 'string' ? "Reference" : item.code;
                                                    const relevance = typeof item === 'string' ? item : item.relevance;
                                                    return (
                                                        <div key={i} className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-3xl">
                                                            <div className="text-indigo-600 font-black uppercase tracking-widest text-[9px] mb-1.5">{code}</div>
                                                            <div className="text-slate-800 font-bold text-base leading-snug">{relevance}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>

                                        <section className="overflow-hidden">
                                            <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
                                                <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                                                {guideContent.timelines.title}
                                            </h2>

                                            <div className="relative">
                                                {/* Desktop Serpentine Timeline */}
                                                <div className="hidden lg:block relative">
                                                    <div className="flex flex-wrap items-start justify-center gap-y-12 text-slate-800">
                                                        {guideContent.timelines.events.map((item, i) => {
                                                            const timeframe = typeof item === 'string' ? "Timeline" : item.timeframe;
                                                            const event = typeof item === 'string' ? item.split(':')[0] || "Stage" : item.event;
                                                            const impact = typeof item === 'string' ? item.split(':').slice(1).join(':').trim() : item.impact;

                                                            const colors = [
                                                                'from-amber-400 to-orange-500',
                                                                'from-orange-500 to-rose-500',
                                                                'from-rose-500 to-indigo-600',
                                                                'from-indigo-600 to-blue-500',
                                                                'from-blue-500 to-emerald-500',
                                                                'from-emerald-500 to-amber-400'
                                                            ];
                                                            const colorClass = colors[i % colors.length];
                                                            const isEvenRow = Math.floor(i / 4) % 2 === 1;
                                                            const rowPosition = i % 4;

                                                            // Determine if we need a connector to the next item
                                                            const hasNext = i < guideContent.timelines.events.length - 1;
                                                            const isEndPerRow = (i + 1) % 4 === 0 || i === guideContent.timelines.events.length - 1;

                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className={`w-1/4 relative px-6 flex flex-col items-center group transition-all duration-500`}
                                                                    style={{ direction: isEvenRow ? 'rtl' : 'ltr' }}
                                                                >
                                                                    {/* Connecting Line (Horizontal) */}
                                                                    {hasNext && !isEndPerRow && (
                                                                        <div className={`absolute top-10 left-[70%] w-full h-[6px] bg-gradient-to-r ${colorClass} opacity-20 group-hover:opacity-40 transition-opacity z-0`}></div>
                                                                    )}

                                                                    {/* Wrapping Curve (Mock) - This would ideally be an SVG for perfect serpentine flow */}
                                                                    {isEndPerRow && hasNext && (
                                                                        <div className={`absolute top-10 ${isEvenRow ? '-left-1/2' : '-right-1/2'} w-full h-12 border-t-[6px] ${isEvenRow ? 'border-l-[6px] rounded-tl-[100px]' : 'border-r-[6px] rounded-tr-[100px]'} border-indigo-100 opacity-30 z-0`}></div>
                                                                    )}

                                                                    <div className="relative z-10 flex flex-col items-center text-center w-full">
                                                                        {/* The Node */}
                                                                        <div className={`w-20 h-20 rounded-full border-[6px] border-indigo-50 bg-white flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:border-indigo-100 transition-all duration-500`}>
                                                                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colorClass} text-white flex items-center justify-center font-black text-xl shadow-lg`}>
                                                                                {i + 1}
                                                                            </div>
                                                                        </div>

                                                                        <div className="bg-indigo-50 text-indigo-900 border border-indigo-100 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-2 mt-[-10px] mb-4 shadow-sm group-hover:bg-indigo-100 transition-colors">
                                                                            {timeframe}
                                                                        </div>

                                                                        <div className="w-full">
                                                                            <h3 className="font-black text-slate-900 text-sm mb-2 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{event}</h3>
                                                                            <p className="text-slate-500 text-[10px] font-normal leading-relaxed line-clamp-4 group-hover:text-slate-700 transition-colors px-4">
                                                                                {impact}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Mobile/Vertical View (Kept for better UX on small screens) */}
                                                <div className="lg:hidden relative pl-8 border-l-[6px] border-indigo-50 space-y-12 ml-4">
                                                    {guideContent.timelines.events.map((item, i) => {
                                                        const timeframe = typeof item === 'string' ? "Timeline" : item.timeframe;
                                                        const event = typeof item === 'string' ? item.split(':')[0] || "Stage" : item.event;
                                                        const impact = typeof item === 'string' ? item.split(':').slice(1).join(':').trim() : item.impact;
                                                        return (
                                                            <div key={i} className="relative group">
                                                                <div className="absolute -left-[45px] top-0 w-8 h-8 rounded-full border-4 border-white bg-indigo-600 text-white flex items-center justify-center font-black text-[10px] shadow-lg group-hover:scale-125 transition-all z-10">
                                                                    {i + 1}
                                                                </div>
                                                                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm group-hover:shadow-xl group-hover:border-indigo-100 transition-all">
                                                                    <div className="bg-indigo-50 text-indigo-900 border border-indigo-100 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest w-fit mb-4">
                                                                        {timeframe}
                                                                    </div>
                                                                    <div className="font-black text-lg text-slate-900 mb-2 leading-tight uppercase tracking-tight">{event}</div>
                                                                    {impact && <div className="text-slate-500 font-normal text-[11px] leading-relaxed italic border-l-2 border-slate-200 pl-4 py-1">{impact}</div>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </section>

                                        <section>
                                            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                                <div className="w-2.5 h-8 bg-indigo-500 rounded-full"></div>
                                                {guideContent.whoIsCommonlyInvolved.title}
                                            </h2>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {guideContent.whoIsCommonlyInvolved.roles.map((item, i) => {
                                                    const roleName = typeof item === 'string' ? item : item.role;
                                                    const roleDesc = typeof item === 'string' ? "" : item.description;
                                                    return (
                                                        <div key={i} className="bg-indigo-50/30 border border-indigo-100/50 p-5 rounded-3xl">
                                                            <div className="font-bold text-slate-900 text-xs mb-1">{roleName}</div>
                                                            {roleDesc && <div className="text-slate-500 text-[10px] font-normal leading-relaxed">{roleDesc}</div>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>

                                        <section>
                                            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                                <div className="w-2.5 h-8 bg-indigo-500 rounded-full"></div>
                                                Resolution Pathway
                                            </h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                                {guideContent.resolutionPathway.map((item, i) => {
                                                    const stepNum = typeof item === 'string' ? (i + 1) : item.step;
                                                    const title = typeof item === 'string' ? item.split(':')[0] || item : item.title;
                                                    const action = typeof item === 'string' ? item.split(':').slice(1).join(':').trim() : item.action;
                                                    return (
                                                        <div key={i} className="flex gap-4">
                                                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md">
                                                                {stepNum}
                                                            </div>
                                                            <div>
                                                                <h3 className="text-sm font-bold text-slate-800 mb-1 leading-tight">{title}</h3>
                                                                {action && <p className="text-slate-500 text-xs font-normal leading-relaxed">{action}</p>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <section className="bg-rose-50/50 p-8 rounded-[2rem] border border-rose-100/50">
                                                <h2 className="text-xl font-black text-rose-800 mb-6 flex items-center gap-3">
                                                    <i className="fa-solid fa-circle-xmark text-rose-500 text-sm"></i>
                                                    {guideContent.whatThisDoesNotMean.title}
                                                </h2>
                                                <ul className="space-y-3">
                                                    {guideContent.whatThisDoesNotMean.points.map((point, i) => (
                                                        <li key={i} className="flex items-start gap-3">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-300 mt-2 flex-shrink-0"></div>
                                                            <span className="text-slate-600 text-sm font-bold leading-relaxed">{point}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </section>
                                            <section className="bg-amber-50/50 p-8 rounded-[2rem] border border-amber-100/50">
                                                <h2 className="text-xl font-black text-amber-800 mb-6 flex items-center gap-3">
                                                    <i className="fa-solid fa-triangle-exclamation text-amber-500 text-sm"></i>
                                                    Common Misunderstandings
                                                </h2>
                                                <div className="space-y-4">
                                                    {guideContent.commonMisunderstandings
                                                        .filter(item => item.misunderstanding && item.reality).length > 0 ? (
                                                        guideContent.commonMisunderstandings
                                                            .filter(item => item.misunderstanding && item.reality)
                                                            .map((item, i) => (
                                                                <div key={i}>
                                                                    <div className="text-amber-900 font-black text-[10px] uppercase tracking-widest mb-1">Misunderstanding</div>
                                                                    <p className="text-amber-700 text-[11px] font-bold italic mb-2">"{item.misunderstanding}"</p>
                                                                    <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">Reality</div>
                                                                    <p className="text-slate-600 text-xs font-normal leading-relaxed">{item.reality}</p>
                                                                </div>
                                                            ))
                                                    ) : (
                                                        <p className="text-slate-500 text-sm italic">Content is being generated. Please refresh the page or click "Back to Library" and try again.</p>
                                                    )}
                                                </div>
                                            </section>
                                        </div>

                                        <section>
                                            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                                <div className="w-2.5 h-8 bg-indigo-500 rounded-full"></div>
                                                Professional Assessment
                                            </h2>
                                            <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-8 text-indigo-900 overflow-hidden relative group">
                                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-600/10 transition-all duration-700"></div>
                                                <h3 className="text-xl font-black mb-4 relative z-10">{guideContent.expertPerspective.title}</h3>
                                                <p className="text-slate-600 text-base font-medium leading-relaxed mb-8 relative z-10 max-w-2xl">
                                                    {guideContent.expertPerspective.assessment}
                                                </p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
                                                    {guideContent.expertPerspective.riskMitigation.map((risk, i) => (
                                                        <div key={i} className="flex items-start gap-3 bg-white/60 border border-white p-4 rounded-xl">
                                                            <i className="fa-solid fa-shield-halved text-indigo-600 text-sm mt-1"></i>
                                                            <span className="font-bold text-slate-800 text-sm leading-snug">{risk}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </section>

                                        <section>
                                            <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                                                <div className="w-2.5 h-8 bg-indigo-500 rounded-full"></div>
                                                Frequently Asked Questions
                                            </h2>
                                            <div className="space-y-4">
                                                {guideContent.faqs.map((item, i) => {
                                                    const question = typeof item === 'string' ? item : item.question;
                                                    const answer = typeof item === 'string' ? "" : item.answer;
                                                    return (
                                                        <div key={i} className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                                                            <h4 className="font-black text-slate-900 mb-2 flex items-center gap-3">
                                                                <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px]">Q</span>
                                                                {question}
                                                            </h4>
                                                            {answer && (
                                                                <p className="text-slate-600 text-sm font-normal leading-relaxed pl-9">
                                                                    {answer}
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </section>

                                        <section>
                                            <h3 className="text-lg font-black text-indigo-600 uppercase tracking-[0.2em] mb-6">Key Takeaways</h3>
                                            <div className="bg-white border-2 border-indigo-50 rounded-[2rem] p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                                                {guideContent.keyTakeaways.map((point, i) => (
                                                    <div key={i} className="flex gap-4">
                                                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px]">
                                                            {i + 1}
                                                        </div>
                                                        <p className="text-slate-700 font-semibold leading-snug text-sm">{point}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>


                                    </div>
                                )}


                                <div className="mt-20 pt-12 border-t border-slate-100">
                                    <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 mb-12">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800 mb-2">Educational Notice:</h4>
                                        <p className="text-xs font-bold text-slate-500 leading-relaxed italic">
                                            This article provides general information about homeownership processes and does not provide legal, tax, or financial advice. Laws and procedures may vary by location and change over time.
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setSelectedGuide(null);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="mt-12 w-full py-6 rounded-[1.5rem] border-2 border-slate-100 text-slate-400 font-black uppercase tracking-[0.2em] text-[9px] hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-100 transition-all cursor-pointer shadow-sm hover:shadow-md"
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
                </div>

                <div className="flex-1 overflow-y-auto py-4 space-y-1">
                    {GUIDE_DATA.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => handleCategoryChange(category.id)}
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
                {/* Header - Simplified as main header is now global */}
                <div className="bg-white border-b border-slate-200 px-10 py-4 shadow-sm sticky top-[73px] z-10">
                    <div className="mb-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                                    {activeCategory.title}
                                </h1>
                            </div>
                        </div>
                    </div>


                </div>

                {/* List View Container */}
                <div className="flex-1 overflow-y-auto p-10 bg-white">
                    <div className="max-w-6xl mx-auto">


                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-12">
                            {filteredItems.map((item, idx) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleViewGuide(item)}
                                    className="group flex gap-6 text-left hover:bg-slate-50/50 p-4 -m-4 rounded-3xl transition-all duration-300"
                                >
                                    {/* Content Snapshot */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-black text-slate-900 mb-2 leading-snug group-hover:text-indigo-600 transition-colors duration-300 truncate">
                                            {item.title}
                                        </h3>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-2 selection:bg-indigo-100">
                                            {item.description || "Detailed professional educational guide covering the legal and regulatory framework in California. This content provides neutral, factual information to help homeowners navigate common property operations."}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default GuidesTab;
