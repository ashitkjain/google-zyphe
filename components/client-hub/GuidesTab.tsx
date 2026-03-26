import React, { useState, useEffect } from 'react';
import GoogleAd from '../shared/GoogleAd';
import { getGuideBySlug, saveGuideContent } from '../../services/firebaseService';
import { generateGuide, generateGuideImage } from '../../services/geminiService';
import { GuideResult } from '../../prompts/client/guideGeneration';
import ArchitecturalStylesArticle, { ARCH_STYLES_SLUG, ARCH_STYLES_SENTINEL } from './ArchitecturalStylesArticle';
import PlatformHelpTab from './PlatformHelpTab';

const PLATFORM_HELP_SENTINEL = 'PLATFORM_HELP_V1';
const PLATFORM_HELP_SLUG = 'platform-technical-manual';
const BUYER_INSTRUCTIONS_SENTINEL = 'BUYER_INSTRUCTIONS_V1';
const BUYER_INSTRUCTIONS_SLUG = 'buyer-instructions';

const BUYER_STEPS = [
    { step: 1, title: 'Authentication', action: "Go to zyphe.ai and click the 'Sign In' button in the header. Login using your provided buyer credentials.", imageUrl: '/guide-images/signin_step.png' },
    { step: 2, title: 'Narrative Search', action: "Type a life needs story into the 'Find My Match' narrator (e.g., 'Large family moving from the East Coast, need top schools and a quiet street').", imageUrl: '/guide-images/search_step.png' },
    { step: 3, title: 'Review Scored Results', action: 'See the AI instantly extract filters and score 10-15 matching properties based on your specific story words.', imageUrl: '/guide-images/results_list_step.png' },
    { step: 4, title: 'Property Selection', action: "Click on a high-scoring matching property and review the 'Property DNA' overview page.", imageUrl: '/guide-images/overview_note_step.png' },
    { step: 5, title: 'Collaboration', action: "Leave a Sticky Note on the property whiteboard (e.g., 'Schools: 9/10, fits perfectly').", imageUrl: '/guide-images/overview_note_step.png' },
    { step: 6, title: 'Finally.. Explore Property DNA', action: 'Dive deep into specialized analysis tabs:\n1. Interior (finishes & layout)\n2. Rooms (bed/bath details)\n3. Exterior (lot & amenities)\n4. Neighborhood (proximate factors)\n5. Schools (top-rated zones)\n6. Community Pulse (local vibe)\n7. Investment Research (ROI & yields)\n8. City Neighborhoods (comparative pockets)\n9. Property Economics (TAX & valuation)\n10. Context Graph (AI-driven mapping)' },
    { step: 7, title: 'Interactive AI Concierge', action: 'Use the Zyphe Concierge chatbot to inquire about specific property details, search for deep-dive insights, and learn more via real-time conversation.', imageUrl: '/guide-images/chatbot_step.png' },
    { step: 8, title: 'Technical Transparency Center', action: "For a deep dive into our 20+ data sources, environmental scoring methodologies, and the 88 decision factors driving our intelligence, visit our technical owner's manual.", link: '/training/platform-technical-manual' }
];

const BuyerInstructionsContent: React.FC<{ onNavigate?: (view: any, path: string) => void }> = ({ onNavigate }) => (
    <div className="max-w-none">
        <p className="text-slate-600 leading-relaxed text-base font-semibold mb-10">
            Discover properties using user stories written in natural language. Users can share their details on who they are, what their lifestyle and needs are, and then use AI to discover matching homes using nuanced insights, collected from a comprehensive set of third party sources, Google Maps, Places, Gemini search grounding and visual AI.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
            {BUYER_STEPS.map((item) => (
                <div key={item.step} className="flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xl shadow-indigo-100">
                            {item.step}
                        </div>
                        <div className="pt-1">
                            <h3 className="text-base font-black text-slate-900 mb-2 leading-tight tracking-tight uppercase">{item.title}</h3>
                            <p className="text-slate-600 text-sm font-medium leading-[1.6] whitespace-pre-line">{item.action}</p>
                        </div>
                    </div>
                    {item.imageUrl && (
                        <div className="rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl shadow-indigo-100/50 bg-slate-50 relative group">
                            <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                            <img src={item.imageUrl} alt={item.title} className="w-full h-auto object-cover transform scale-100 group-hover:scale-[1.02] transition-transform duration-700" />
                        </div>
                    )}
                    {(item as any).link && (
                        <button
                            onClick={() => {
                                if (onNavigate) onNavigate('knowledge_center', (item as any).link);
                                else window.location.href = (item as any).link;
                            }}
                            className="flex items-center gap-3 px-6 py-3 bg-slate-900 border border-slate-800 text-white rounded-2xl hover:bg-black hover:scale-105 transition-all shadow-xl shadow-slate-200/50 group/link w-fit"
                        >
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover/link:bg-indigo-500 transition-colors">
                                <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                            </div>
                            <div className="text-left">
                                <div className="text-[10px] font-black uppercase tracking-widest leading-none">Open Resource</div>
                                <div className="text-[11px] font-bold text-slate-400 group-hover/link:text-white transition-colors">Platform Technical Manual</div>
                            </div>
                        </button>
                    )}
                </div>
            ))}
        </div>
    </div>
);

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
            { id: 'h7', title: 'Can HOA restrict rentals in California?', slug: 'can-hoa-restrict-rentals-in-california', description: 'California law significantly limits the ability of HOAs to prohibit rentals. While some restrictions on short-term stays may exist, associations generally cannot ban long-term leasing.' },
            { id: 'h8', title: 'What happens if you ignore HOA violation notices?', slug: 'what-happens-if-you-ignore-hoa-violation-notices', description: 'Ignoring a violation notice can lead to escalating fines, suspension of privileges, and potential legal action. Understanding the HOA dispute process is crucial for timely resolution.' },
            { id: 'h9', title: 'Can HOA tow your car from your driveway?', slug: 'can-hoa-tow-your-car-from-your-driveway', description: 'In California, HOAs have the authority to enforce parking rules, including towing from driveways under specific procedural requirements and notice periods.' },
            { id: 'h10', title: 'HOA dispute process explained', slug: 'hoa-dispute-process-explained', description: 'The HOA dispute process in California involves informal communication, Internal Dispute Resolution (IDR), and potentially formal mediation before legal action.' },
            { id: 'h11', title: 'Can HOA fine without notice?', slug: 'can-hoa-fine-without-notice', description: 'HOAs must generally provide notice and an opportunity for a hearing before levying fines. This guide explores the procedural protections afforded to homeowners.' },
            { id: 'h12', title: 'What rights do homeowners have against HOA?', slug: 'what-rights-do-homeowners-have-against-hoa', description: 'Homeowners possess significant rights under the Davis-Stirling Act, including rights to fair elections, record inspection, and due process in enforcement.' },
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
            { id: 'i5', title: 'Replacement cost vs actual cash value', slug: 'replacement-cost-vs-actual-cash-value', description: 'Replacement cost covers the full price of new items, while actual cash value factors in depreciation. Choosing the right coverage impacts your final settlement.' },
            { id: 'i6', title: 'Does filing a claim raise premiums?', slug: 'does-filing-a-claim-raise-premiums', description: 'While filing a claim can lead to premium increases, California law offers certain protections. Understanding how insurers assess risk after a loss is vital.' },
            { id: 'i7', title: 'What damages are excluded from homeowners insurance?', slug: 'what-damages-are-excluded-from-homeowners-insurance', description: 'Standard policies often exclude earth movement, flood, and neglect. This guide clarifies common "peril" exclusions and how to fill coverage gaps.' },
            { id: 'i8', title: 'Can insurance cancel coverage after a claim?', slug: 'can-insurance-cancel-coverage-after-a-claim', description: 'Non-renewal or cancellation after a claim is regulated in California. Learn about the notice requirements and your rights as a policyholder.' },
            { id: 'i9', title: 'What is subrogation in homeowners insurance?', slug: 'what-is-subrogation-in-homeowners-insurance', description: 'Subrogation is the process where your insurer pursues a third party for damages they paid on your behalf. It affects your deductible and final settlement.' },
            { id: 'i10', title: 'What if insurance payout is less than repair cost?', slug: 'what-if-insurance-payout-is-less-than-repair-cost', description: 'Discrepancies between payouts and repair costs are common. This brief explores supplemental claims, contractor estimates, and the appraisal process.' },
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
            { id: 'e5', title: 'What is a preliminary title report?', slug: 'what-is-a-preliminary-title-report', description: 'This report details property ownership history and any existing liens. It is vital for identifying potential legal hurdles before the sale is finalized.' },
            { id: 'e6', title: 'Common title defects explained', slug: 'common-title-defects-explained', description: 'From forged documents to undisclosed heirs, title defects can derail a closing. Learn how title insurance protects your ownership rights.' },
            { id: 'e7', title: 'Can escrow close without repairs?', slug: 'can-escrow-close-without-repairs', description: 'Closing "as-is" or with repair credits is a common negotiation. This guide explores the legal and financial implications of deferred maintenance.' },
            { id: 'e8', title: 'What happens if escrow doesn’t close on time?', slug: 'what-happens-if-escrow-doesnt-close-on-time', description: 'Missed closing dates can lead to per-diem fees or contract cancellation. Understanding "time of the essence" clauses is critical for both parties.' },
            { id: 'e9', title: 'Who chooses the title company?', slug: 'who-chooses-the-title-company', description: 'While negotiable, local customs often dictate who pays for and selects the title insurer. Learn about the RESPA regulations governing this choice.' },
            { id: 'e10', title: 'What happens if buyer backs out during escrow?', slug: 'what-happens-if-buyer-backs-out-during-escrow', description: 'Buyer cancellation triggers discussions about earnest money deposits and liquidated damages. This brief outlines the contingency removal process.' },
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
            { id: 't1', title: 'What happens if property taxes go unpaid?', slug: 'what-happens-if-property-taxes-go-unpaid', description: 'Unpaid property taxes can lead to significant penalties, tax liens, and eventually, a tax sale. Understanding the five-year redemption period is key.' },
            { id: 't2', title: 'How long before a tax lien is placed?', slug: 'how-long-before-a-tax-lien-is-placed', description: 'In California, property taxes become delinquent after April 10. This guide explains the timeline from initial delinquency to formal lien recording.' },
            { id: 't3', title: 'What is a supplemental tax bill in California?', slug: 'supplemental-tax-bill-california', description: 'A supplemental tax bill captures the difference in property value after a change in ownership. It is a one-time adjustment separate from annual bills.' },
            { id: 't4', title: 'Why did my property taxes increase suddenly?', slug: 'why-did-my-property-taxes-increase-suddenly', description: 'Sudden increases often result from reassessments, special assessments (Mello-Roos), or the expiration of exemptions like the homeowners exemption.' },
            { id: 't5', title: 'What triggers reassessment?', slug: 'what-triggers-reassessment', description: 'New construction or changes in ownership are the primary triggers for reassessment under Proposition 13. Learn about the few common exceptions.' },
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
            { id: 'm1', title: 'Who pays for fence repairs between neighbors?', slug: 'who-pays-for-fence-repairs', description: 'California’s Good Neighbor Fence Act generally requires adjoining owners to share responsibility for maintaining boundaries. Learn how it affects your costs.' },
            { id: 'm2', title: 'Who is responsible for sidewalk injuries?', slug: 'homeowner-liability-sidewalk-injuries', description: 'Liability for sidewalk injuries depends on local ordinances and whether the damage was caused by private trees or public infrastructure.' },
            { id: 'm3', title: 'Does homeowners insurance cover water leaks?', slug: 'does-homeowners-insurance-cover-water-leaks', description: 'Sudden and accidental leaks are typically covered, while gradual seepage is often excluded. Understanding the "ensuing loss" clause is essential.' },
            { id: 'm4', title: 'Who pays for sewer line repairs?', slug: 'who-pays-for-sewer-line-repairs', description: 'Homeowners are typically responsible for the lateral line from the house to the public main. This guide explores insurance riders and city responsibility.' },
            { id: 'm5', title: 'What happens if unpermitted work is discovered?', slug: 'what-happens-if-unpermitted-work-is-discovered', description: 'Unpermitted work can lead to retroactive permits, fines, or required demolition. It is a critical disclosure item during a California home sale.' },
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
    },
    {
        id: 'solar',
        topicSlug: 'solar',
        title: 'Solar & Sustainability',
        icon: 'fa-solar-panel',
        count: '1 page',
        items: [
            {
                id: 's1',
                title: 'How Solar Production is Estimated',
                slug: 'how-solar-production-is-estimated',
                description: 'Understand the methodology behind our solar potential calculations, including roof area analysis, panel efficiency, and local sunshine data.'
            },
        ]
    },
    {
        id: 'architecture',
        topicSlug: 'architecture',
        title: 'Architectural Styles',
        icon: 'fa-building-columns',
        count: '1 page',
        items: [
            {
                id: 'arch1',
                title: 'Residential Architectural Styles Explained',
                slug: 'residential-architectural-styles',
                description: 'A visual guide to the most prominent home styles — from Colonial symmetry and Victorian ornamentation to Mid-Century Modern and everything in between.'
            },
        ]
    },
    {
        id: 'buyer_instructions',
        topicSlug: 'training',
        title: 'Buyer Experience Instructions',
        icon: 'fa-chalkboard-user',
        count: '1 page',
        items: [
            {
                id: 't1',
                title: 'Buyer Experience Instructions',
                slug: 'buyer-instructions',
                description: ''
            }
        ]
    },
    {
        id: 'technical_manual',
        topicSlug: 'training',
        title: 'Platform Technical Manual',
        icon: 'fa-microchip',
        count: '4 sections',
        items: [
            { id: 'h1', title: 'Data and Intelligence', slug: 'helpCategory:data_and_intelligence', description: '' },
            { id: 'h2', title: 'Messaging & SMS', slug: 'helpCategory:messaging', description: '' },
            { id: 'h4', title: 'Distressed Property Finder', slug: 'helpCategory:investment_analysis', description: '' },
            { id: 'h5', title: 'Database Schema', slug: 'helpCategory:db_schema', description: '' },
        ]
    }
];


interface GuidesTabProps {
    onNavigate?: (view: any, path: string) => void;
    showOnlyIds?: string[];
    excludeIds?: string[];
    initialCategoryId?: string;
}

const GuidesTab: React.FC<GuidesTabProps> = ({ onNavigate, showOnlyIds, excludeIds, initialCategoryId }) => {
    // Filter data based on provided IDs
    let displayData = showOnlyIds 
        ? GUIDE_DATA.filter(c => showOnlyIds.includes(c.id))
        : (excludeIds 
            ? GUIDE_DATA.filter(c => !excludeIds.includes(c.id))
            : GUIDE_DATA);

    const [activeCategoryId, setActiveCategoryId] = useState(
        initialCategoryId || displayData[0]?.id || GUIDE_DATA[0].id
    );

    // Sync state if initialCategoryId changes
    const autoLoadRef = React.useRef(false);
    useEffect(() => {
        const targetId = initialCategoryId || displayData[0]?.id;
        if (targetId) {
            setActiveCategoryId(targetId);
            const cat = GUIDE_DATA.find(c => c.id === targetId);
            if (cat && cat.items.length === 1) {
                // Auto-load content for single-item categories
                autoLoadRef.current = true;
            } else {
                setSelectedGuide(null);
            }
        }
    }, [initialCategoryId, showOnlyIds, excludeIds]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGuide, setSelectedGuide] = useState<GuideItem | null>(null);
    const [guideContent, setGuideContent] = useState<GuideResult | string | null>(null);
    const [loadingContent, setLoadingContent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeCategory = GUIDE_DATA.find(c => c.id === activeCategoryId) || displayData[0] || GUIDE_DATA[0];

    const handleViewGuide = async (guide: GuideItem, categoryOverride?: GuideCategory) => {
        const category = categoryOverride || activeCategory;
        setSelectedGuide(guide);
        setLoadingContent(true);
        setError(null);

        // Update URL
        const newPath = `/${category.topicSlug}/${guide.slug}`;
        if (onNavigate) {
            onNavigate('knowledge_center', newPath);
        } else if (window.location.pathname !== newPath) {
            window.history.pushState({ mode: 'knowledge_center' }, '', newPath);
        }

        // Static pages don't need Firebase or AI
        if (guide.slug === ARCH_STYLES_SLUG) {
            setGuideContent(ARCH_STYLES_SENTINEL);
            setLoadingContent(false);
            return;
        }

        if (guide.slug === PLATFORM_HELP_SLUG) {
            setGuideContent(PLATFORM_HELP_SENTINEL);
            setLoadingContent(false);
            return;
        }

        // Buyer instructions — inline
        if (guide.slug === BUYER_INSTRUCTIONS_SLUG) {
            setGuideContent(BUYER_INSTRUCTIONS_SENTINEL);
            setLoadingContent(false);
            return;
        }

        // Help category pages render PlatformHelpTab inline
        if (guide.slug.startsWith('helpCategory:')) {
            setGuideContent(`helpCategory:${guide.slug.split(':')[1]}`);
            setLoadingContent(false);
            return;
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

    // Update document title when guide is selected
    useEffect(() => {
        if (selectedGuide) {
            document.title = `${selectedGuide.title} | Zyphe Guides`;
        } else {
            document.title = 'Zyphe | Real Estate Intelligence';
        }

        return () => {
            document.title = 'Zyphe | Real Estate Intelligence';
        };
    }, [selectedGuide]);

    // Auto-load single-item categories on mount/switch
    useEffect(() => {
        if (autoLoadRef.current) {
            autoLoadRef.current = false;
            const cat = GUIDE_DATA.find(c => c.id === activeCategoryId);
            if (cat && cat.items.length === 1) {
                handleViewGuide(cat.items[0], cat);
            }
        }
    }, [activeCategoryId]);

    const handleCategoryChange = (catId: string) => {
        setActiveCategoryId(catId);
        const category = GUIDE_DATA.find(c => c.id === catId);
        if (category && category.items.length === 1) {
            // Single-item category: skip list view, go straight to content
            handleViewGuide(category.items[0], category);
        } else if (showOnlyIds && category && category.items.length > 1) {
            // In filtered/showOnlyIds mode with multi-item category: auto-load first child
            handleViewGuide(category.items[0], category);
        } else {
            setSelectedGuide(null);
            if (category) {
                const newPath = `/${category.topicSlug}`;
                if (onNavigate) {
                    onNavigate('knowledge_center', newPath);
                } else if (window.location.pathname !== newPath) {
                    window.history.pushState({ mode: 'knowledge_center' }, '', newPath);
                }
            }
        }
    };

    const handleGoBack = () => {
        setSelectedGuide(null);
        const category = GUIDE_DATA.find(c => c.id === activeCategoryId);
        const newPath = category ? `/${category.topicSlug}` : '/guides';

        if (onNavigate) {
            onNavigate('knowledge_center', newPath);
        } else if (window.location.pathname !== newPath) {
            window.history.pushState({ mode: 'knowledge_center' }, '', newPath);
        }
    };

    const filteredItems = activeCategory.items.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedGuide) {
        const guideContentView = (
            <div className="flex-1 flex flex-col bg-white overflow-auto animate-in fade-in duration-500">
                {/* Article Header - only show back button when NOT in showOnlyIds mode */}
                {!showOnlyIds && (
                    <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 transition-all">
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
                )}

                {/* Article Body */}
                <div className="bg-white">
                    <div className={`mx-auto px-6 py-12 pb-20 ${(typeof guideContent === 'string' && guideContent.startsWith('helpCategory:')) || guideContent === BUYER_INSTRUCTIONS_SENTINEL ? '' : 'max-w-5xl px-10'}`}>
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
                                {guideContent === ARCH_STYLES_SENTINEL ? (
                                    <ArchitecturalStylesArticle />
                                ) : guideContent === PLATFORM_HELP_SENTINEL ? (
                                    <PlatformHelpTab hideSidebar />
                                ) : guideContent === BUYER_INSTRUCTIONS_SENTINEL ? (
                                    <BuyerInstructionsContent onNavigate={onNavigate} />
                                ) : typeof guideContent === 'string' && guideContent.startsWith('helpCategory:') ? (
                                    <PlatformHelpTab hideSidebar initialCategoryId={guideContent.split(':')[1]} />
                                ) : typeof guideContent === 'string' ? (
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
                                    <div className="flex flex-col lg:flex-row gap-12">
                                        <div className="flex-1 w-full min-w-0 space-y-16">
                                            {guideContent.introduction && (
                                                <section>
                                                    <p className="text-slate-600 leading-relaxed text-base font-semibold">
                                                        {guideContent.introduction}
                                                    </p>
                                                </section>
                                            )}

                                            {selectedGuide.slug !== 'buyer-instructions' && (
                                                <>
                                                    {guideContent.title && (
                                                        <h1 className="text-2xl font-black text-slate-900 mb-6 border-l-4 border-indigo-600 pl-6 leading-tight tracking-tight">
                                                            {guideContent.title}
                                                        </h1>
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        {guideContent.whatThisMeans?.content && (
                                                            <section className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100/50">
                                                                <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-3">
                                                                    <i className="fa-solid fa-circle-info text-indigo-500 text-sm"></i>
                                                                    {guideContent.whatThisMeans.title}
                                                                </h2>
                                                                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                                                    {guideContent.whatThisMeans.content}
                                                                </p>
                                                            </section>
                                                        )}
                                                        {guideContent.whyThisHappens?.content && (
                                                            <section className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100/50">
                                                                <h2 className="text-lg font-black text-slate-800 mb-3 flex items-center gap-3">
                                                                    <i className="fa-solid fa-circle-question text-indigo-500 text-sm"></i>
                                                                    {guideContent.whyThisHappens.title}
                                                                </h2>
                                                                <p className="text-slate-600 text-sm leading-relaxed font-medium">
                                                                    {guideContent.whyThisHappens.content}
                                                                </p>
                                                            </section>
                                                        )}
                                                    </div>

                                                    <div className="w-full flex justify-center py-6 bg-slate-50/50 rounded-2xl my-8">
                                                        <GoogleAd slotId="1111111111" format="auto" label="Ad Unit #1 - In-Content" className="w-full max-w-3xl" />
                                                    </div>

                                                    {guideContent.legalFramework?.statutes?.length > 0 && (
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
                                                                            <div className="text-indigo-600 font-black uppercase tracking-widest text-[11px] mb-3">{code}</div>
                                                                            <div className="text-slate-800 font-normal text-[13px] leading-relaxed">{relevance}</div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </section>
                                                    )}

                                                    {guideContent.timelines?.events?.length > 0 && (
                                                        <section className="overflow-hidden">
                                                            <h2 className="text-xl font-black text-slate-800 mb-8 flex items-center gap-3">
                                                                <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                                                                {guideContent.timelines.title}
                                                            </h2>

                                                            <div className="relative">
                                                                <div className="hidden md:block relative">
                                                                    <div className="flex flex-wrap items-start justify-center gap-y-12 text-slate-800">
                                                                        {guideContent.timelines.events.map((item, i) => {
                                                                            const timeframe = typeof item === 'string' ? "Timeline" : item.timeframe;
                                                                            const event = typeof item === 'string' ? item.split(':')[0] || "Stage" : item.event;
                                                                            const impact = typeof item === 'string' ? item.split(':').slice(1).join(':').trim() : item.impact;

                                                                            const colors = ['from-amber-400 to-orange-500', 'from-orange-500 to-rose-500', 'from-rose-500 to-indigo-600', 'from-indigo-600 to-blue-500', 'from-blue-500 to-emerald-500', 'from-emerald-500 to-amber-400'];
                                                                            const colorClass = colors[i % colors.length];
                                                                            const isEvenRow = Math.floor(i / 4) % 2 === 1;
                                                                            const hasNext = i < guideContent.timelines.events.length - 1;
                                                                            const isEndPerRow = (i + 1) % 4 === 0 || i === guideContent.timelines.events.length - 1;

                                                                            return (
                                                                                <div key={i} className={`w-1/4 relative px-6 flex flex-col items-center group transition-all duration-500`} style={{ direction: isEvenRow ? 'rtl' : 'ltr' }}>
                                                                                    {hasNext && !isEndPerRow && (
                                                                                        <div className={`absolute top-10 left-[70%] w-full h-[6px] bg-gradient-to-r ${colorClass} opacity-20 group-hover:opacity-40 transition-opacity z-0`}></div>
                                                                                    )}
                                                                                    {isEndPerRow && hasNext && (
                                                                                        <div className={`absolute top-10 ${isEvenRow ? '-left-1/2' : '-right-1/2'} w-full h-12 border-t-[6px] ${isEvenRow ? 'border-l-[6px] rounded-tl-[100px]' : 'border-r-[6px] rounded-tr-[100px]'} border-indigo-100 opacity-30 z-0`}></div>
                                                                                    )}
                                                                                    <div className="relative z-10 flex flex-col items-center text-center w-full">
                                                                                        <div className={`w-20 h-20 rounded-full border-[6px] border-indigo-50 bg-white flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:border-indigo-100 transition-all duration-500`}>
                                                                                            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colorClass} text-white flex items-center justify-center font-black text-xl shadow-lg`}>{i + 1}</div>
                                                                                        </div>
                                                                                        <div className="bg-indigo-50 text-indigo-900 border border-indigo-100 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-2 mt-[-10px] mb-4 shadow-sm group-hover:bg-indigo-100 transition-colors">{timeframe}</div>
                                                                                        <div className="w-full">
                                                                                            <h3 className="font-medium text-slate-900 text-sm mb-2 group-hover:text-indigo-600 transition-colors capitalize">{event.toLowerCase()}</h3>
                                                                                            {impact && <p className="text-slate-500 text-[10px] font-normal leading-relaxed line-clamp-4 group-hover:text-slate-700 transition-colors px-4">{impact}</p>}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                                <div className="md:hidden relative pl-8 border-l-[6px] border-indigo-50 space-y-12 ml-4">
                                                                    {guideContent.timelines.events.map((item, i) => {
                                                                        const timeframe = typeof item === 'string' ? "Timeline" : item.timeframe;
                                                                        const event = typeof item === 'string' ? item.split(':')[0] || "Stage" : item.event;
                                                                        const impact = typeof item === 'string' ? item.split(':').slice(1).join(':').trim() : item.impact;
                                                                        return (
                                                                            <div key={i} className="relative group">
                                                                                <div className="absolute -left-[45px] top-0 w-8 h-8 rounded-full border-4 border-white bg-indigo-600 text-white flex items-center justify-center font-black text-[10px] shadow-lg group-hover:scale-125 transition-all z-10">{i + 1}</div>
                                                                                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm group-hover:shadow-xl group-hover:border-indigo-100 transition-all">
                                                                                    <div className="bg-indigo-50 text-indigo-900 border border-indigo-100 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest w-fit mb-4">{timeframe}</div>
                                                                                    <div className="font-medium text-lg text-slate-900 mb-2 leading-tight capitalize">{event.toLowerCase()}</div>
                                                                                    {impact && <div className="text-slate-500 font-normal text-[11px] leading-relaxed italic border-l-2 border-slate-200 pl-4 py-1">{impact}</div>}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </section>
                                                    )}

                                                    {guideContent.whoIsCommonlyInvolved?.roles?.length > 0 && (
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
                                                    )}
                                                </>
                                            )}

                                            {guideContent.resolutionPathway?.length > 0 && (
                                                <section>
                                                    {selectedGuide.slug !== 'buyer-instructions' && (
                                                        <h2 className="text-2xl font-black text-slate-800 mb-8 flex items-center gap-3">
                                                            <div className="w-2.5 h-8 bg-indigo-500 rounded-full"></div>
                                                            Instructions
                                                        </h2>
                                                    )}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
                                                        {guideContent.resolutionPathway.map((item, i) => {
                                                            const stepNum = typeof item === 'string' ? (i + 1) : item.step;
                                                            const title = typeof item === 'string' ? item.split(':')[0] || item : item.title;
                                                            const action = typeof item === 'string' ? item.split(':').slice(1).join(':').trim() : item.action;
                                                            return (
                                                                <div key={i} className="flex gap-6 items-start">
                                                                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xl shadow-indigo-100">
                                                                        {stepNum}
                                                                    </div>
                                                                    <div className="pt-1">
                                                                        <h3 className="text-base font-black text-slate-900 mb-2 leading-tight tracking-tight uppercase">{title}</h3>
                                                                        {action && <p className="text-slate-600 text-sm font-medium leading-[1.6] whitespace-pre-line">{action}</p>}
                                                                        {item.imageUrl && (
                                                                            <div className="mt-6 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl shadow-indigo-100/50 bg-slate-50 relative group">
                                                                                <div className="absolute inset-0 bg-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                                                                <img
                                                                                    src={item.imageUrl}
                                                                                    alt={title}
                                                                                    className="w-full h-auto object-cover transform scale-100 group-hover:scale-[1.02] transition-transform duration-700"
                                                                                />
                                                                            </div>
                                                                        )}
                                                                        {item.link && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (onNavigate) onNavigate('knowledge_center', item.link);
                                                                                    else window.location.href = item.link;
                                                                                }}
                                                                                className="mt-6 flex items-center gap-3 px-6 py-3 bg-slate-900 border border-slate-800 text-white rounded-2xl hover:bg-black hover:scale-105 transition-all shadow-xl shadow-slate-200/50 group/link"
                                                                            >
                                                                                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover/link:bg-indigo-500 transition-colors">
                                                                                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                                                                </div>
                                                                                <div className="text-left">
                                                                                    <div className="text-[10px] font-black uppercase tracking-widest leading-none">Open Resource</div>
                                                                                    <div className="text-[11px] font-bold text-slate-400 group-hover/link:text-white transition-colors capitalize">{item.link.split('/').pop()?.replace('-', ' ')}</div>
                                                                                </div>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </section>
                                            )}

                                            {selectedGuide.slug !== 'buyer-instructions' && (
                                                <>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        {guideContent.whatThisDoesNotMean?.points?.length > 0 && (
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
                                                        )}
                                                        {guideContent.commonMisunderstandings?.length > 0 && (
                                                            <section className="bg-amber-50/50 p-8 rounded-[2rem] border border-amber-100/50">
                                                                <h2 className="text-xl font-black text-amber-800 mb-6 flex items-center gap-3">
                                                                    <i className="fa-solid fa-triangle-exclamation text-amber-500 text-sm"></i>
                                                                    Common Misunderstandings
                                                                </h2>
                                                                <div className="space-y-4">
                                                                    {guideContent.commonMisunderstandings.filter(item => item.misunderstanding && item.reality).map((item, i) => (
                                                                        <div key={i} className="border-b border-amber-100 last:border-0 pb-4 last:pb-0">
                                                                            <p className="text-amber-800 text-[12px] font-bold italic mb-1.5 leading-snug">"{item.misunderstanding}"</p>
                                                                            <p className="text-slate-600 text-[11px] font-normal leading-relaxed"><span className="text-slate-400 font-black text-[9px] uppercase tracking-widest mr-2 inline-block">Reality:</span>{item.reality}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </section>
                                                        )}
                                                    </div>

                                                    {guideContent.expertPerspective?.riskMitigation?.length > 0 && (
                                                        <section>
                                                            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                                                <div className="w-2.5 h-8 bg-indigo-500 rounded-full"></div>
                                                                Professional Assessment
                                                            </h2>
                                                            <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-8 text-indigo-900 overflow-hidden relative group">
                                                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-indigo-600/10 transition-all duration-700"></div>
                                                                <h3 className="text-xl font-black mb-4 relative z-10">{guideContent.expertPerspective.title}</h3>
                                                                <p className="text-slate-600 text-base font-medium leading-relaxed mb-8 relative z-10 max-w-2xl">{guideContent.expertPerspective.assessment}</p>
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
                                                    )}

                                                    {guideContent.faqs?.length > 0 && (
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
                                                                            {answer && <p className="text-slate-600 text-sm font-normal leading-relaxed pl-9">{answer}</p>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </section>
                                                    )}

                                                    {guideContent.keyTakeaways?.length > 0 && (
                                                        <section>
                                                            <h3 className="text-lg font-black text-indigo-600 uppercase tracking-[0.2em] mb-6">Key Takeaways</h3>
                                                            <div className="bg-white border-2 border-indigo-50 rounded-[2rem] p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                                                                {guideContent.keyTakeaways.map((point, i) => (
                                                                    <div key={i} className="flex gap-4">
                                                                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px]">{i + 1}</div>
                                                                        <p className="text-slate-700 font-semibold leading-snug text-sm">{point}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </section>
                                                    )}

                                                    <div className="w-full flex justify-center py-8 bg-slate-50 border-t border-slate-100 mt-12 mb-8 rounded-3xl">
                                                        <GoogleAd slotId="3333333333" format="auto" label="Ad Unit #3 - End of Article" className="w-full max-w-3xl" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}


                                {!(typeof guideContent === 'string' && guideContent.startsWith('helpCategory:')) && guideContent !== BUYER_INSTRUCTIONS_SENTINEL && (
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
                                )}
                            </article>
                        )}
                    </div>
                </div >
            </div >
        );

        // If in filtered/showOnlyIds mode, wrap with sidebar
        if (showOnlyIds && displayData.length > 0) {
            return (
                <div className="flex flex-col-reverse lg:flex-row h-full bg-[#F8FAFC] animate-in fade-in duration-500">
                    <div className="w-full lg:w-80 h-auto lg:h-full border-t lg:border-t-0 lg:border-r border-slate-200 bg-white flex flex-row lg:flex-col shadow-lg lg:shadow-sm z-20 shrink-0">
                        <div className="flex-1 w-full overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto flex flex-row lg:flex-col p-2 lg:p-0 gap-2 lg:gap-1 no-scrollbar">
                            {displayData.map((category) => (
                                <div key={category.id}>
                                    <button
                                        onClick={() => handleCategoryChange(category.id)}
                                        className={`flex lg:w-full items-center justify-center lg:justify-between px-3 py-2 lg:px-6 lg:py-4 transition-all group rounded-xl lg:rounded-none min-w-[80px] lg:min-w-0 ${activeCategoryId === category.id
                                            ? 'bg-indigo-50 lg:bg-indigo-50 lg:border-r-4 border-indigo-600'
                                            : 'hover:bg-slate-50 lg:border-r-4 border-transparent'
                                            }`}
                                    >
                                        <div className="flex flex-col lg:flex-row items-center gap-1 lg:gap-4">
                                            <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-all ${activeCategoryId === category.id
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-indigo-500 shadow-inner'
                                                }`}>
                                                <i className={`fa-solid ${category.icon} text-xs lg:text-sm`}></i>
                                            </div>
                                            <div className="text-center lg:text-left">
                                                <div className={`text-[10px] lg:text-xs font-black tracking-tight whitespace-nowrap ${activeCategoryId === category.id ? 'text-indigo-900' : 'text-slate-600'
                                                    }`}>
                                                    {category.title}
                                                </div>
                                            </div>
                                        </div>
                                        <i className={`hidden lg:block fa-solid fa-chevron-${activeCategoryId === category.id && category.items.length > 1 ? 'down' : 'right'} text-[8px] transition-transform ${activeCategoryId === category.id ? 'text-indigo-400' : 'text-slate-300 opacity-0 group-hover:opacity-100'
                                            }`}></i>
                                    </button>
                                    {/* Show child items for multi-item categories — always visible */}
                                    {category.items.length > 1 && (
                                        <div className="hidden lg:block pl-8 pr-2 pb-2 space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                                            {category.items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => handleViewGuide(item, category)}
                                                    className={`w-full text-left px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                                                        selectedGuide?.id === item.id 
                                                            ? 'text-indigo-600 bg-indigo-50/80 border-l-2 border-indigo-500' 
                                                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {item.title}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    {guideContentView}
                </div>
            );
        }

        return guideContentView;
    }

    return (
        <div className="flex flex-col-reverse lg:flex-row h-full bg-[#F8FAFC] animate-in fade-in duration-500">
            {/* Sidebar / Bottom Nav - Hide if only 1 category shown */}
            {displayData.length > 1 && (
                <div className="w-full lg:w-80 h-auto lg:h-full border-t lg:border-t-0 lg:border-r border-slate-200 bg-white flex flex-row lg:flex-col shadow-lg lg:shadow-sm z-20 shrink-0">
                    <div className="flex-1 w-full overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto flex flex-row lg:flex-col p-2 lg:p-0 gap-2 lg:gap-1 no-scrollbar">
                        {displayData.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => handleCategoryChange(category.id)}
                                className={`flex lg:w-full items-center justify-center lg:justify-between px-3 py-2 lg:px-6 lg:py-4 transition-all group rounded-xl lg:rounded-none min-w-[80px] lg:min-w-0 ${activeCategoryId === category.id
                                    ? 'bg-indigo-50 lg:bg-indigo-50 lg:border-r-4 border-indigo-600'
                                    : 'hover:bg-slate-50 lg:border-r-4 border-transparent'
                                    }`}
                            >
                                <div className="flex flex-col lg:flex-row items-center gap-1 lg:gap-4">
                                    <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-all ${activeCategoryId === category.id
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                        : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-indigo-500 shadow-inner'
                                        }`}>
                                        <i className={`fa-solid ${category.icon} text-xs lg:text-sm`}></i>
                                    </div>
                                    <div className="text-center lg:text-left">
                                        <div className={`text-[10px] lg:text-xs font-black tracking-tight whitespace-nowrap ${activeCategoryId === category.id ? 'text-indigo-900' : 'text-slate-600'
                                            }`}>
                                            {category.title}
                                        </div>
                                    </div>
                                </div>
                                <i className={`hidden lg:block fa-solid fa-chevron-right text-[8px] transition-transform ${activeCategoryId === category.id ? 'text-indigo-400 translate-x-1' : 'text-slate-300 opacity-0 group-hover:opacity-100'
                                    }`}></i>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col transition-all">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 px-10 py-8">
                    <div className="mb-4">
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">
                            {activeCategory.title}
                        </h1>
                    </div>
                </div>

                {/* List View Container */}
                <div className="p-10 bg-white">
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
                                        {item.description && (
                                            <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-2 selection:bg-indigo-100 mb-3">
                                                {item.description}
                                            </p>
                                        )}

                                    </div>

                                    {/* Link Icon Indicator */}
                                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-indigo-50 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all self-start border border-indigo-100/50">
                                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuidesTab;
