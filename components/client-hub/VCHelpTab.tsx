import React, { useState } from 'react';

type SidebarPage = 'buyer_experience' | 'realtor_experience';
type TopTab = 'features' | 'instructions';
type FeatureTab = 'crm_funnel' | 'closing' | 'reactivate';
type GuideTab = 'dashboard' | 'match' | 'intelligence' | 'video' | 'buyer';

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
            Discover properties using user stories written in natural language. Users can share their details on who they are, what their lifestyle and needs are, and then use AI to discover matching homes using nuanced insights, collected from a comprehensive set of third party sources, Google Maps, Places, Zyphe AI search grounding and visual AI.
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

const CRM_FEATURES = [
    {
        id: 1,
        feature: 'Lead Pipeline & Stage Timeline',
        description: 'A 6-stage visual pipeline (Leads → Nurture → Active Search → Offer → Contract → Closed) with three view modes — Kanban (drag-and-drop stage transitions), Gallery (mobile-optimized cards), and List. Includes per-stage entry dates, days-in-stage counters, and a full audit log of every transition.'
    },
    {
        id: 2,
        feature: 'Contact Management & Segmentation',
        description: 'Rich client profiles with engagement scoring (Hot / Warm / Cold / Stale) and buyer-vs-seller segmentation. Each type surfaces relevant fields — Buying Power & Budget Range for buyers, Listing Readiness & Estimated Value for sellers.'
    },
    {
        id: 3,
        feature: 'Task, Event & Quick Actions',
        description: 'Priority-based task management (Low → Urgent), per-client calendar events, and drag-to-drop sticky notes for ad-hoc reminders. One-click quick actions (+Event, +Task, Edit) directly from the client header.'
    },
    {
        id: 4,
        feature: 'Communication & Nurture Tracking',
        description: 'Chronological nurture log capturing every call, text, and email — with date, channel, summary, and outcome. Aggregated call-count badges provide at-a-glance engagement visibility.'
    },
    {
        id: 5,
        feature: 'Deal Snapshots & Tour Feedback',
        description: 'Context-aware panels per deal stage: Offer Snapshot (price, earnest money, contingencies), Search Snapshot (must-haves, tours, rejected offers), and Closing Snapshot (key dates, lender, escrow). Per-property tour feedback with star ratings and full offer history.'
    },
    {
        id: 6,
        feature: 'Lead Ingestion & Data Import',
        description: 'Import leads from email inboxes, spreadsheets, and CSV files. Automated parsing, field mapping, and deduplication ensure clean data flows directly into the pipeline.'
    }
];

const CRM_COMPARISON = [
    { capability: 'Visual Funnel Pipeline', zyphe: '✅ 6-stage with timeline + audit', followUpBoss: '✅ Customizable stages', kvcore: '✅ Smart CRM', liondesk: '⚠️ Basic', wiseagent: '⚠️ Basic' },
    { capability: 'Engagement Scoring & Segmentation', zyphe: '✅ Buyer/Seller + Hot/Warm/Cold/Stale', followUpBoss: '⚠️ Manual tagging', kvcore: '✅ AI lead scoring', liondesk: '⚠️ Basic tags', wiseagent: '❌' },
    { capability: 'Context-Aware Deal Snapshots', zyphe: '✅ Offer/Search/Closing + tour feedback', followUpBoss: '❌', kvcore: '❌', liondesk: '❌', wiseagent: '❌' },
    { capability: 'Task + Event Management', zyphe: '✅ Priorities + calendar + sticky notes', followUpBoss: '✅ Action plans', kvcore: '✅ Smart campaigns', liondesk: '✅ Reminders', wiseagent: '✅ Drip campaigns' },
    { capability: 'Communication Tracking', zyphe: '✅ Multi-channel nurture log', followUpBoss: '✅ Call tracking + SMS', kvcore: '✅ Dialer + email', liondesk: '✅ Video + email', wiseagent: '⚠️ Email only' },
    { capability: 'Lead Ingestion & Data Import', zyphe: '✅ Email, CSV, spreadsheets', followUpBoss: '✅ 200+ integrations', kvcore: '✅ Auto-capture', liondesk: '⚠️ Manual import', wiseagent: '⚠️ CSV only' },
    { capability: 'IDX Property Search', zyphe: '✅ AI-powered grid + filters', followUpBoss: '⚠️ Via partners', kvcore: '✅ Built-in IDX', liondesk: '❌', wiseagent: '❌' },
];

const REACTIVATE_FEATURES = [
    {
        id: 1,
        feature: 'Old Leads',
        description: 'Filter archived/stale leads by city, search, and sort. Paginated table with bulk-select and per-lead action menus across 5 channels (Email, SMS, Call, WhatsApp, Direct Mail) — each with 10+ templated strategy scripts.'
    },
    {
        id: 2,
        feature: 'AI Plan',
        description: 'Upload or select leads → Gemini analyzes the database → produces per-lead priority scores, sequenced outreach steps (day offsets, channels, messages), market context (rates trend, inventory, days-on-market), and recommended daily volume.'
    },
    {
        id: 3,
        feature: 'Respond (Action Center)',
        description: 'Real-time inbox of inbound replies and overdue follow-ups with sentiment tags (positive/negative/question), priority flags, and dismiss/archive actions. Auto-detects which sequence step is overdue.'
    },
    {
        id: 4,
        feature: 'Report (Snapshot)',
        description: 'Time-sliceable analytics dashboard (All/Today/Week/Month) showing total leads, conversations started, reply rate, reactivated count, total messages, and markets covered.'
    },
    {
        id: 5,
        feature: 'Message Trail',
        description: 'Full audit log of every outbound, inbound, and AI-recommended message. Sortable and filterable by lead, type (Sent/Received/Recommended), channel, content, and timestamp with pagination.'
    },
    {
        id: 6,
        feature: 'Triggers (Future)',
        description: 'Configurable market signal triggers: Rate Drop Alert, Inventory Spike, Price Reduction, Lead Anniversary — each with custom thresholds, active/inactive toggle, and monitored lead counts.'
    }
];

const REACTIVATE_COMPARISON = [
    {
        capability: 'Multi-channel outreach',
        zyphe: '5 channels (Email, SMS, Call, WhatsApp, Mail)',
        followUpBoss: '3 (Email, SMS, Call)',
        boldTrail: '3 (Email, SMS, Call)',
        sierra: '3 (SMS, Email, Voicemail)'
    },
    {
        capability: 'AI-generated reactivation plans',
        zyphe: '✅ Gemini-powered',
        followUpBoss: '❌',
        boldTrail: '❌',
        sierra: '⚠️ AI text only'
    },
    {
        capability: 'Strategy template library',
        zyphe: '40+ templates across channels',
        followUpBoss: 'Basic drip templates',
        boldTrail: 'Email templates',
        sierra: 'Limited'
    },
    {
        capability: 'Respond inbox (replies + overdue)',
        zyphe: '✅ Sentiment-tagged',
        followUpBoss: '✅ Centralized inbox',
        boldTrail: '✅',
        sierra: '✅'
    },
    {
        capability: 'Market context in plans',
        zyphe: '✅ Per-market (rates, inventory, DOM)',
        followUpBoss: '❌',
        boldTrail: '❌',
        sierra: '❌'
    },
    {
        capability: 'Automated drip sequences',
        zyphe: '✅ AI-generated day-offset sequences',
        followUpBoss: '✅ Behavior-triggered',
        boldTrail: '✅ Behavioral automation',
        sierra: '✅ Behavior-based'
    },
    {
        capability: 'Reactivation analytics',
        zyphe: '✅ Time-sliceable report',
        followUpBoss: '⚠️ Basic stats',
        boldTrail: '✅ Reporting suite',
        sierra: '⚠️ Limited'
    },
    {
        capability: 'Full message audit trail',
        zyphe: '✅ Filterable/sortable',
        followUpBoss: '⚠️ Activity log',
        boldTrail: '✅',
        sierra: '⚠️'
    },
    {
        capability: 'WhatsApp + Direct Mail',
        zyphe: '✅ Both',
        followUpBoss: '❌',
        boldTrail: '❌',
        sierra: '❌'
    },
    {
        capability: 'CSV import + AI analysis',
        zyphe: '✅',
        followUpBoss: '❌',
        boldTrail: '⚠️ Import only',
        sierra: '❌'
    }
];

const CLOSING_FEATURES = [
    {
        id: 1,
        feature: 'Transaction Management & Gantt Chart',
        description: 'Full interactive Gantt chart with List / Weekly / Daily zoom levels, SVG dependency arrows, and category rollup bars. Dependency-aware task scheduling engine auto-cascades dates from acceptance through closing. Supports 8-phase buyer checklist (45+ tasks) and 5-phase seller checklist (16 tasks).'
    },
    {
        id: 2,
        feature: 'Party & Stakeholder Registry',
        description: 'Complete CRUD for all transaction stakeholders with 9 pre-defined roles (Buyer, Seller, Agent, Co-Agent, Escrow, Title, Lender, TC, Other). Includes per-party signer tracking flags for closing day coordination.'
    },
    {
        id: 3,
        feature: 'Document Management & Versioning',
        description: 'Full document lifecycle management with Firebase Storage uploads, multi-version history tracking, inline previews via signed URLs. Each document tracks category, status (Pending/Completed/Rejected), file hash, and version chain.'
    },
    {
        id: 4,
        feature: 'Audit Trail & Compliance Log',
        description: 'Every CREATE, UPDATE, and DELETE action is recorded with actor tracking (System vs User), entity-level diffs, and full sort/filter/pagination (25 items per page). Provides transparency and regulatory compliance.'
    },
    {
        id: 5,
        feature: 'Unified CRM → Closing Pipeline',
        description: 'Transactions auto-create when a lead enters "In Contract" funnel stage — zero manual data re-entry. Transaction Wizard guides agents through a 4-step setup. Closing prep (T-7) and post-close follow-up reminders fire automatically. Auto-cleanup on stage rollback.'
    }
];

const CLOSING_COMPARISON = [
    { capability: 'Visual Gantt Chart', zyphe: '✅ 3 zoom levels + SVG deps', skyslope: '❌', dotloop: '❌', lonewolf: '❌', listedkit: '⚠️ Basic' },
    { capability: 'Dependency Scheduling', zyphe: '✅ Full DAG engine', skyslope: '❌', dotloop: '❌', lonewolf: '❌', listedkit: '❌' },
    { capability: 'Document Versioning', zyphe: '✅ Multi-version', skyslope: '✅', dotloop: '✅', lonewolf: '✅', listedkit: '❌' },
    { capability: 'Audit Trail', zyphe: '✅ Filterable + paginated', skyslope: '✅ Compliance-grade', dotloop: '⚠️ Activity feed', lonewolf: '✅', listedkit: '❌' },
    { capability: 'Native E-Signatures', zyphe: '❌ Coming', skyslope: '✅ DigiSign', dotloop: '✅ Native', lonewolf: '✅ Authentisign', listedkit: '❌' },
    { capability: 'CRM Integration', zyphe: '✅ Native (same platform)', skyslope: '⚠️ Separate', dotloop: '⚠️ Limited', lonewolf: '✅ Ecosystem', listedkit: '⚠️ Basic' },
    { capability: 'Buyer/Seller Checklists', zyphe: '✅ Differentiated', skyslope: '❌ Generic', dotloop: '❌ Generic', lonewolf: '❌ Generic', listedkit: '✅ AI-extracted' },
    { capability: 'Post-Close Intelligence', zyphe: '✅ Unique', skyslope: '❌', dotloop: '❌', lonewolf: '❌', listedkit: '❌' },
    { capability: 'Broker Compliance', zyphe: '❌ Coming', skyslope: '✅ Auto-audit', dotloop: '✅ Review loops', lonewolf: '✅ Heavy', listedkit: '⚠️' },
    { capability: 'Mobile App', zyphe: '❌ Coming', skyslope: '✅', dotloop: '✅', lonewolf: '✅', listedkit: '❌' },
];

const CLOSING_GAPS = [
    { name: 'E-Signatures (DocuSign / HelloSign)', priority: 'Critical' },
    { name: 'Broker Compliance Workflows', priority: 'High' },
    { name: 'Automated Party Notifications', priority: 'High' },
    { name: 'AI Contract Analysis', priority: 'Medium' },
    { name: 'Commission Tracking & Accounting', priority: 'Medium' },
    { name: 'Mobile App', priority: 'High' },
];

interface VCHelpTabProps {
    onNavigate?: (view: any, path: string) => void;
}

const VCHelpTab: React.FC<VCHelpTabProps> = ({ onNavigate }) => {
    const [activePage, setActivePage] = useState<SidebarPage>('realtor_experience');
    const [topTab, setTopTab] = useState<TopTab>('features');
    const [featureTab, setFeatureTab] = useState<FeatureTab>('crm_funnel');
    const [guideTab, setGuideTab] = useState<GuideTab>('dashboard');

    const sidebarPages: { id: SidebarPage; label: string; icon: string }[] = [
        { id: 'buyer_experience', label: 'Buyer Experience', icon: 'fa-user' },
        { id: 'realtor_experience', label: 'Realtor Experience', icon: 'fa-briefcase' },
    ];

    const topTabs: { id: TopTab; label: string; icon: string }[] = [
        { id: 'features', label: 'Features', icon: 'fa-star' },
        { id: 'instructions', label: 'Instructions', icon: 'fa-book-open' },
    ];

    const featureTabs: { id: FeatureTab; label: string; icon: string }[] = [
        { id: 'crm_funnel', label: 'CRM / Funnel', icon: 'fa-chart-line' },
        { id: 'closing', label: 'Closing', icon: 'fa-file-invoice-dollar' },
        { id: 'reactivate', label: 'Reactivate', icon: 'fa-bolt' },
    ];

    const guideTabs: { id: GuideTab; label: string; icon: string }[] = [
        { id: 'dashboard', label: '1. Pipeline', icon: 'fa-chart-line' },
        { id: 'match', label: '2. Search', icon: 'fa-wand-magic-sparkles' },
        { id: 'intelligence', label: '3. Intelligence', icon: 'fa-brain' },
        { id: 'video', label: '4. Video call', icon: 'fa-video' },
        { id: 'buyer', label: '5. Buyer hub', icon: 'fa-user' },
    ];

    const renderFeatureContent = () => {
        switch (featureTab) {
            case 'crm_funnel':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                The CRM and Funnel module is the foundation of the Zyphe agent experience — a 6-stage visual pipeline that tracks every lead from first contact through contract close. It combines contact management, engagement scoring, task scheduling, communication logging, and deal-stage snapshots into a single, unified workspace so agents never have to switch between tools. Zyphe can integrate and ingest data from emails, spreadsheets, and other sources.
                            </p>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg bg-white">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900">
                                        <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest w-12">#</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest w-72">CRM Feature</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest">Our Implementation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {CRM_FEATURES.map((item) => (
                                        <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">
                                                    {item.id}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-black text-slate-900 tracking-tight">{item.feature}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-medium text-slate-600 leading-relaxed">{item.description}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Competitive Comparison */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-lg shadow-indigo-100">
                                    <i className="fa-solid fa-scale-balanced"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">vs. Industry Leaders</h3>
                                    <p className="text-slate-500 font-medium text-sm">How our CRM compares to Follow Up Boss, kvCORE, LionDesk, and Wise Agent.</p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg bg-white">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900">
                                            <th className="px-5 py-4 text-[10px] font-black text-white uppercase tracking-widest">Capability</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-indigo-300 uppercase tracking-widest">Zyphe (Us)</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Follow Up Boss</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">kvCORE</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">LionDesk</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Wise Agent</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {CRM_COMPARISON.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-black text-slate-800">{row.capability}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg">{row.zyphe}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.followUpBoss}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.kvcore}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.liondesk}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.wiseagent}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'closing':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                The Closing module manages the entire post-contract transaction lifecycle — from acceptance day through keys-in-hand. It features a dependency-aware Gantt scheduler that auto-cascades dates across inspection, appraisal, title, and financing milestones, with differentiated buyer and seller checklists, full document versioning, party management, and a compliance-grade audit trail. Transactions auto-create from the CRM pipeline with zero re-entry.
                            </p>
                        </div>
                        {/* Feature Table */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg bg-white">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900">
                                        <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest w-12">#</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest w-72">Closing Feature</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest">Our Implementation</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {CLOSING_FEATURES.map((item) => (
                                        <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
                                                    {item.id}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-black text-slate-900 tracking-tight">{item.feature}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-medium text-slate-600 leading-relaxed">{item.description}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Competitive Comparison */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg shadow-lg shadow-emerald-100">
                                    <i className="fa-solid fa-scale-balanced"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">vs. Industry Leaders</h3>
                                    <p className="text-slate-500 font-medium text-sm">How our closing platform compares to SkySlope, Dotloop, Lone Wolf, and ListedKit AI.</p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg bg-white">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900">
                                            <th className="px-5 py-4 text-[10px] font-black text-white uppercase tracking-widest">Capability</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-emerald-300 uppercase tracking-widest">Zyphe (Us)</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">SkySlope</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dotloop</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lone Wolf</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ListedKit AI</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {CLOSING_COMPARISON.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-black text-slate-800">{row.capability}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">{row.zyphe}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.skyslope}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.dotloop}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.lonewolf}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.listedkit}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Coming Soon / Gaps */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-lg shadow-lg shadow-amber-100">
                                    <i className="fa-solid fa-rocket"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Coming Soon</h3>
                                    <p className="text-slate-500 font-medium text-sm">Market-standard features identified through competitive analysis.</p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg bg-white">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900">
                                            <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest">Feature</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest w-32 text-center">Priority</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest w-32 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {CLOSING_GAPS.map((gap, i) => (
                                            <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                                                <td className="px-6 py-5">
                                                    <span className="text-sm font-black text-slate-900 tracking-tight">{gap.name}</span>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${gap.priority === 'Critical'
                                                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                                            : gap.priority === 'High'
                                                                ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                                : 'bg-sky-50 text-sky-600 border border-sky-100'
                                                        }`}>
                                                        {gap.priority}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                                                        <i className="fa-solid fa-clock text-[7px]"></i>
                                                        Coming
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'reactivate':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                The Reactivate engine turns dormant leads into live opportunities through multi-channel outreach across 5 channels (Email, SMS, Call, WhatsApp, and Direct Mail). Gemini AI analyzes your stale lead database to generate priority-scored, sequenced outreach plans with market context — then tracks every reply, flags sentiment, and surfaces overdue follow-ups in a real-time action center.
                            </p>
                        </div>
                        {/* Feature Table */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg bg-white">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900">
                                        <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest w-12">#</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest w-56">Module</th>
                                        <th className="px-6 py-4 text-[11px] font-black text-white uppercase tracking-widest">What It Does</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {REACTIVATE_FEATURES.map((item) => (
                                        <tr key={item.id} className="hover:bg-amber-50/30 transition-colors group">
                                            <td className="px-6 py-5">
                                                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-amber-100 group-hover:scale-110 transition-transform">
                                                    {item.id}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-black text-slate-900 tracking-tight">{item.feature}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="text-sm font-medium text-slate-600 leading-relaxed">{item.description}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Competitive Comparison */}
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-lg shadow-lg shadow-amber-100">
                                    <i className="fa-solid fa-scale-balanced"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">vs. Industry Leaders</h3>
                                    <p className="text-slate-500 font-medium text-sm">How our reactivation engine compares to leading realtor tools.</p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg bg-white">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900">
                                            <th className="px-5 py-4 text-[10px] font-black text-white uppercase tracking-widest">Capability</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-amber-300 uppercase tracking-widest">Zyphe (Us)</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Follow Up Boss</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">BoldTrail</th>
                                            <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sierra</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {REACTIVATE_COMPARISON.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-black text-slate-800">{row.capability}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">{row.zyphe}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.followUpBoss}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.boldTrail}</span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className="text-xs font-medium text-slate-500">{row.sierra}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const renderGuideContent = () => {
        switch (guideTab) {
            case 'dashboard':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-chart-line"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Realtor Dashboard & Pipeline</h3>
                                <p className="text-slate-500 font-medium">Review incoming leads and prioritize outreach based on AI insights.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Review the Funnel</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Note the **10 New Leads** in the first column. Identify high-interest indicators (🔥 icons) and motivations like "Need more space for growing family".
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/realtor_dashboard.png" alt="Realtor Dashboard" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">B</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Check Pending Tasks</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Go to **Tools &gt; Tasks**. View urgent tasks such as "Call Sarah Miller" or "Send analysis to David".
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/realtor_tasks.png" alt="Realtor Tasks" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">C</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Examine Communication History</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Go to the **Clients** tab and select a lead (e.g., Robert Thompson). Review the **Communication History** to see past SMS/Email touchpoints.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/realtor_client_history.png" alt="Client History" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'match':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">AI-Driven "Find My Match"</h3>
                                <p className="text-slate-500 font-medium">Transform a buyer's life narrative into structured property matches.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Input a Buyer Story</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Navigate to the **Explore** tab. Use the storyteller box to describe the client's vision (e.g., commute, school quality, lifestyle).
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/explore_story.png" alt="Explore Story" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">B</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Run Matcher & Review Results</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Click **Find My Match**. Watch Gemini extract price, beds, baths, and location filters automatically. Scroll through the ranked results.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/explore_results.png" alt="Explore Results" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'intelligence':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-brain"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Deep Property Intelligence</h3>
                                <p className="text-slate-500 font-medium">Analyze a specific property with story-aware AI insights.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">View AI Concierge Summary</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Read the **Concierge Summary**. Notice how it flags pros/cons specific to the buyer's school and commute needs.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/property_analysis.png" alt="AI Summary" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">B</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Visual Intelligence Report</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Check the **Visual Intelligence Report** for kitchen condition, presence of solar, and architectural style analysis based on property photos.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/property_visual_intelligence.png" alt="Visual Report" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'video':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-video"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Collaborative Video Session</h3>
                                <p className="text-slate-500 font-medium">Engage with the buyer in a live, white-glove video consultation.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Premium Connection UI</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Click the floating **"Call Concierge"** button in the bottom left. This triggers a sleek connection overlay while the secure session is established.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-900 max-w-4xl">
                                    <img src="/images/guide/concierge_call.png" alt="Concierge Call" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'buyer':
                return (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-100">
                                <i className="fa-solid fa-user"></i>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Buyer Portal & Library</h3>
                                <p className="text-slate-500 font-medium">Ensure the buyer has all assets needed to proceed with confidence.</p>
                            </div>
                        </div>

                        <div className="space-y-16">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">A</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Verify Shared Insights</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Log in as **buyer@fc.com**. Review the shared Guides and AI Reports discussed during the live session in the **Hub**.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/buyer_hub.png" alt="Buyer Hub" className="w-full" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs">B</div>
                                    <h4 className="font-black text-slate-900 leading-tight">Knowledge Center & Guides</h4>
                                </div>
                                <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                                    Access the **Library** to review custom property educational guides shared by the concierge.
                                </p>
                                <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white max-w-4xl">
                                    <img src="/images/guide/buyer_library.png" alt="Buyer Library" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const renderRealtorContent = () => (
        <div className="max-w-6xl mx-auto py-2">
            {/* Top-Level Tabs: Features | Instructions */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.5rem] mb-8 border border-slate-200">
                {topTabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setTopTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-[1.2rem] text-sm font-black transition-all duration-300 ${topTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]'
                                : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'
                            }`}
                    >
                        <i className={`fa-solid ${tab.icon} ${topTab === tab.id ? 'animate-pulse' : ''}`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            {topTab === 'features' && (
                <>
                    {/* Feature Sub-Tabs */}
                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.5rem] mb-12 border border-slate-200 sticky top-4 z-50 shadow-sm backdrop-blur-md bg-white/80">
                        {featureTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setFeatureTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-[1.2rem] text-sm font-black transition-all duration-300 ${featureTab === tab.id
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]'
                                        : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'
                                    }`}
                            >
                                <i className={`fa-solid ${tab.icon} ${featureTab === tab.id ? 'animate-pulse' : ''}`}></i>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="pb-40">
                        {renderFeatureContent()}
                    </div>
                </>
            )}

            {topTab === 'instructions' && (
                <div className="pb-40">
                    {renderGuideContent()}
                </div>
            )}
        </div>
    );

    return (
        <div className="flex h-full bg-[#F8FAFC] animate-in fade-in duration-500">
            {/* Left Sidebar */}
            <div className="w-72 h-full border-r border-slate-200 bg-white flex flex-col shadow-sm shrink-0">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Experience Guide</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sidebarPages.map((page) => (
                        <button
                            key={page.id}
                            onClick={() => setActivePage(page.id)}
                            className={`flex w-full items-center justify-between px-5 py-4 transition-all group rounded-xl ${activePage === page.id
                                ? 'bg-indigo-50 border-r-4 border-indigo-600'
                                : 'hover:bg-slate-50 border-r-4 border-transparent'
                            }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activePage === page.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                    : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-indigo-500 shadow-inner'
                                }`}>
                                    <i className={`fa-solid ${page.icon} text-sm`}></i>
                                </div>
                                <div className={`text-xs font-black tracking-tight ${activePage === page.id ? 'text-indigo-900' : 'text-slate-600'}`}>
                                    {page.label}
                                </div>
                            </div>
                            <i className={`fa-solid fa-chevron-right text-[8px] transition-transform ${activePage === page.id ? 'text-indigo-400' : 'text-slate-300 opacity-0 group-hover:opacity-100'}`}></i>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="py-12 px-8 sm:px-12 lg:px-16">
                    {activePage === 'buyer_experience' && (
                        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <BuyerInstructionsContent onNavigate={onNavigate} />
                        </div>
                    )}
                    {activePage === 'realtor_experience' && renderRealtorContent()}
                </div>
            </div>
        </div>
    );
};

export default VCHelpTab;
