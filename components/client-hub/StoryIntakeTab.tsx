import React, { useState, useCallback } from 'react';
import ClientEditModal from './ClientEditModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoryIntakeData {
    name: string;
    email: string;
    phone: string;
    preferredMethod: 'Email' | 'Phone';
    budget: string;
    targetLocations: string;
    personaProfile: string;
    targetTimeline: string;
    chapter01: string; // Identity & Background
    chapter02: string; // Daily Rituals & Lifestyle
    chapter03: string; // Architectural & Emotional Soul
    chapter04: string; // What Else Is Important
    selectedAnchors: string[];
    customAnchor: string;
}

interface Props {
    isRealtor?: boolean;
    onMatchRequest?: (story: string, filters: { budgetMin: string; budgetMax: string; beds: string; baths: string }) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ATMOSPHERIC_ANCHORS = [
    'Walking Distance to Coffee',
    'Quiet Streets',
    'Top-Rated Schools',
    'Large Backyard',
    'Home Office Ready',
    'Pet-Friendly Parks',
    'Low Wildfire Risk',
    'Tech Commute Access',
    'Private / Gated',
    'Gourmet Grocery Access',
    'Sustainable Architecture',
    'Modern Kitchen',
    'Natural Light / Open Plan',
    'Vastu / Good Orientation',
    'Mid-Century Aesthetic',
    'ADU Potential',
    'High ROI Potential',
    'Multi-Gen Living',
    'Single Story',
    'Pool Ready',
];

const CHAPTERS = [
    {
        num: '01',
        title: 'Who You Are',
        prompt: 'Tell us about your household background and current life stage.',
        placeholder: 'e.g. A growing family with two young children, Empty nesters, Tech couple in their 30s relocating from SF...',
        key: 'chapter01' as const,
    },
    {
        num: '02',
        title: 'Daily Rituals & Lifestyle',
        prompt: 'Describe your day-to-day flow. Where do you drink your morning coffee? Do you need a dedicated workspace?',
        placeholder: 'I start my day with a quiet espresso looking over a garden... I usually work from home three days a week and need absolute silence...',
        key: 'chapter02' as const,
    },
    {
        num: '03',
        title: 'The Dream Space',
        prompt: 'What are the essential architectural or emotional anchors for your next property?',
        placeholder: 'High ceilings and natural light are non-negotiable. I want a kitchen that opens into a garden for entertaining...',
        key: 'chapter03' as const,
    },
    {
        num: '04',
        title: 'What Else Is Important To You',
        prompt: 'Anything else — schools, commute, risk tolerance, deal-breakers?',
        placeholder: 'Top-rated schools are a must. Low wildfire risk is critical. We\'d prefer to avoid HOA communities. Commute to Palo Alto should be under 30 minutes...',
        key: 'chapter04' as const,
    },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const StoryIntakeTab: React.FC<Props> = ({ isRealtor = false, onMatchRequest }) => {
    const [data, setData] = useState<StoryIntakeData>({
        name: '',
        email: '',
        phone: '',
        preferredMethod: 'Email',
        budget: '',
        targetLocations: '',
        personaProfile: '',
        targetTimeline: '',
        chapter01: '',
        chapter02: '',
        chapter03: '',
        chapter04: '',
        selectedAnchors: [],
        customAnchor: '',
    });

    const [synthesizing, setSynthesizing] = useState(false);
    const [saved, setSaved] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);

    const update = useCallback(<K extends keyof StoryIntakeData>(key: K, value: StoryIntakeData[K]) => {
        setData(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    }, []);

    const toggleAnchor = (label: string) => {
        setData(prev => ({
            ...prev,
            selectedAnchors: prev.selectedAnchors.includes(label)
                ? prev.selectedAnchors.filter(a => a !== label)
                : [...prev.selectedAnchors, label],
        }));
    };

    const addCustomAnchor = () => {
        const trimmed = data.customAnchor.trim();
        if (!trimmed || data.selectedAnchors.includes(trimmed)) return;
        setData(prev => ({
            ...prev,
            selectedAnchors: [...prev.selectedAnchors, trimmed],
            customAnchor: '',
        }));
    };

    const fullStory = [data.chapter01, data.chapter02, data.chapter03, data.chapter04]
        .filter(Boolean)
        .join('\n\n');

    // Synthetic client object pre-filled from story form
    const syntheticClient = {
        id: null,
        firstName: data.name.split(' ')[0] || '',
        lastName: data.name.split(' ').slice(1).join(' ') || '',
        email: data.email,
        phone: data.phone,
        primaryContact: {
            email: data.email,
            phone: data.phone,
            preferredMethod: data.preferredMethod,
        },
        financialVitals: { budgetMax: data.budget.replace(/[^0-9]/g, ''), preApprovalStatus: false, isAllCash: false },
        searchCriteria: {
            locations: data.targetLocations,
            targetTimeline: data.targetTimeline,
            personaProfile: data.personaProfile,
            mustHaves: [data.chapter01, data.chapter04].filter(Boolean).join('\n'),
            dealBreakers: '',
        },
        leadInfo: { customerMessage: fullStory },
        motivation: data.chapter02,
    };

    const wordCount = fullStory.split(/\s+/).filter(Boolean).length;
    const isReady = fullStory.length > 30 || data.selectedAnchors.length > 0;

    const handleDiscover = async () => {
        if (!isReady) return;
        setSynthesizing(true);
        await new Promise(r => setTimeout(r, 1200));
        setSynthesizing(false);
        setSaved(true);
        onMatchRequest?.(fullStory, {
            budgetMin: '',
            budgetMax: data.budget.replace(/[^0-9]/g, ''),
            beds: '',
            baths: '',
        });
    };

    return (
        <>
        <div className="animate-in fade-in duration-400 min-h-screen bg-slate-50/60 pb-24">

            {/* ── Page Header ── */}
            <div className="px-8 pt-8 pb-6 max-w-5xl mx-auto">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                    Your Home Story: Tell Us Your Vision
                </h1>
                <p className="mt-2 text-sm text-slate-500 font-medium max-w-xl leading-relaxed">
                    Our AI builds a property profile beyond basic metrics. Share your
                    narrative to uncover homes aligned with your life.
                </p>
            </div>

            {/* ── Body Grid ── */}
            <div className="max-w-5xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">

                {/* ── LEFT: Profile Panel ── */}
                <div className="space-y-4">
                    {/* Profile card */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                                <i className="fa-solid fa-user text-slate-500 text-xs"></i>
                            </div>
                            <span className="text-sm font-black text-slate-900">Your Profile</span>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">
                                {isRealtor ? 'Client Name' : 'Full Name'}
                            </label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={e => update('name', e.target.value)}
                                placeholder={isRealtor ? 'e.g. Eleanor & James Vance' : 'e.g. Alexander Sterling'}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            />
                        </div>

                        {/* Email Address */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                    Email Address
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={data.preferredMethod === 'Email'}
                                        onChange={() => update('preferredMethod', 'Email')}
                                        className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider group-hover:text-slate-600 transition-colors">Preferred</span>
                                </label>
                            </div>
                            <input
                                type="email"
                                value={data.email}
                                onChange={e => update('email', e.target.value)}
                                placeholder="e.g. alex@example.com"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            />
                        </div>

                        {/* Phone Number */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">
                                    Phone Number
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={data.preferredMethod === 'Phone'}
                                        onChange={() => update('preferredMethod', 'Phone')}
                                        className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider group-hover:text-slate-600 transition-colors">Preferred</span>
                                </label>
                            </div>
                            <input
                                type="tel"
                                value={data.phone}
                                onChange={e => update('phone', e.target.value)}
                                placeholder="e.g. (555) 000-0000"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">
                                Budget Preference
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                <input
                                    type="text"
                                    value={data.budget}
                                    onChange={e => update('budget', e.target.value)}
                                    placeholder="1,800,000"
                                    className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                                />
                            </div>
                        </div>

                        {/* Target Locations */}
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">
                                Target Locations
                            </label>
                            <input
                                type="text"
                                value={data.targetLocations}
                                onChange={e => update('targetLocations', e.target.value)}
                                placeholder="e.g. Pleasanton, Dublin, San Ramon"
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            />
                        </div>

                        {/* Personal Profile */}
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">
                                Personal Profile
                            </label>
                            <div className="relative">
                                <select
                                    value={data.personaProfile}
                                    onChange={e => update('personaProfile', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>Select Profile Type</option>
                                    {['First-Time', 'Investor', 'Past Client', 'Relocation'].map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <i className="fa-solid fa-chevron-down text-[10px]"></i>
                                </div>
                            </div>
                        </div>

                        {/* Target Timeline */}
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-1.5">
                                Target Timeline
                            </label>
                            <div className="relative">
                                <select
                                    value={data.targetTimeline}
                                    onChange={e => update('targetTimeline', e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="" disabled>Select Timeline</option>
                                    {['ASAP', '1-3 Months', '3-6 Months', '6-12 Months', 'Just Browsing'].map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <i className="fa-solid fa-chevron-down text-[10px]"></i>
                                </div>
                            </div>
                        </div>

                        {/* Request more info link */}
                        <button
                            onClick={() => setEditModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors group"
                        >
                            <i className="fa-solid fa-pen-to-square text-[10px] group-hover:scale-110 transition-transform"></i>
                            Add more details (contact, timeline, financials)
                        </button>
                    </div>

                    {/* AI Precision card */}
                    <div className="bg-slate-900 rounded-2xl p-5 text-white">
                        <div className="flex items-center gap-2 mb-3">
                            <i className="fa-solid fa-wand-magic-sparkles text-indigo-400 text-sm"></i>
                            <span className="text-sm font-black">AI Precision</span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed font-medium">
                            Our engine analyzes over 120 property factors and cross-references
                            your narrative against real listings using context graphs.
                        </p>
                    </div>

                    {/* Realtor-only: Synthesize button */}
                    {isRealtor && (
                        <button
                            onClick={handleDiscover}
                            disabled={synthesizing || !isReady}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-lg hover:bg-indigo-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {synthesizing
                                ? <><i className="fa-solid fa-spinner animate-spin text-xs"></i>Running match...</>
                                : <><i className="fa-solid fa-bolt text-xs"></i>Synthesize Match</>
                            }
                        </button>
                    )}

                    {/* Progress indicator */}
                    {wordCount > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                            <div className="flex-1">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, (wordCount / 100) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 flex-shrink-0">{wordCount} words</span>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Narrative Chapters ── */}
                <div className="space-y-5">
                    {CHAPTERS.map(ch => (
                        <div key={ch.num} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            {/* Chapter header */}
                            <div className="px-6 pt-5 pb-3 flex items-start gap-4">
                                <span className="text-3xl font-black text-slate-100 leading-none select-none flex-shrink-0 mt-0.5">
                                    {ch.num}
                                </span>
                                <div>
                                    <h2 className="text-base font-black text-slate-900">{ch.title}</h2>
                                    <p className="text-xs text-slate-400 font-medium mt-0.5 italic">{ch.prompt}</p>
                                </div>
                            </div>

                            {/* Textarea */}
                            <div className="px-6 pb-5">
                                <textarea
                                    value={data[ch.key]}
                                    onChange={e => update(ch.key, e.target.value)}
                                    placeholder={ch.placeholder}
                                    rows={4}
                                    className="w-full resize-none px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all leading-relaxed"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Atmospheric Anchors ── */}
            <div className="max-w-5xl mx-auto px-8 mt-8">
                <div className="bg-white rounded-2xl border border-slate-200 px-6 py-5">
                    <div className="flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-waveform-lines text-slate-400 text-xs"></i>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            Atmospheric Anchors
                        </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {ATMOSPHERIC_ANCHORS.map(anchor => {
                            const isSelected = data.selectedAnchors.includes(anchor);
                            return (
                                <button
                                    key={anchor}
                                    onClick={() => toggleAnchor(anchor)}
                                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                                        isSelected
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                                    }`}
                                >
                                    {anchor}
                                </button>
                            );
                        })}

                        {/* Custom anchors already added */}
                        {data.selectedAnchors
                            .filter(a => !ATMOSPHERIC_ANCHORS.includes(a))
                            .map(a => (
                                <button
                                    key={a}
                                    onClick={() => toggleAnchor(a)}
                                    className="px-4 py-2 rounded-full text-xs font-semibold bg-indigo-600 text-white border border-indigo-600 transition-all"
                                >
                                    {a}
                                </button>
                            ))}

                        {/* Add custom */}
                        <div className="flex items-center gap-1 border border-dashed border-slate-300 rounded-full px-3 py-1.5">
                            <input
                                type="text"
                                value={data.customAnchor}
                                onChange={e => update('customAnchor', e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAnchor(); } }}
                                placeholder="Add your own..."
                                className="bg-transparent text-xs font-medium text-slate-600 placeholder:text-slate-300 outline-none w-28"
                            />
                            {data.customAnchor.trim() && (
                                <button
                                    onClick={addCustomAnchor}
                                    className="px-2 py-0.5 bg-slate-900 text-white rounded-full text-[9px] font-black"
                                >
                                    +
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Footer CTA ── */}
            <div className="max-w-5xl mx-auto px-8 mt-6 flex items-center justify-between">
                <div className="text-[10px] text-slate-400 font-medium">
                    {saved
                        ? <><i className="fa-solid fa-check text-emerald-500 mr-1"></i>Your story is saved</>
                        : data.selectedAnchors.length > 0
                            ? `${data.selectedAnchors.length} anchor${data.selectedAnchors.length > 1 ? 's' : ''} selected`
                            : 'Select anchors or write your story to begin'
                    }
                </div>
                <button
                    onClick={handleDiscover}
                    disabled={synthesizing || !isReady}
                    className="flex items-center gap-3 px-7 py-3.5 bg-slate-900 text-white rounded-2xl text-sm font-black tracking-wide shadow-xl hover:bg-indigo-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {synthesizing ? (
                        <><i className="fa-solid fa-spinner animate-spin"></i>Finding matches...</>
                    ) : (
                        <>Begin Discovery <i className="fa-solid fa-arrow-right ml-1"></i></>
                    )}
                </button>
            </div>
        </div>

        {/* ── ClientEditModal (pre-filled from story data) ── */}
        <ClientEditModal
            client={syntheticClient}
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onSave={async (updates) => {
                // Pull key fields back into story form
                if (updates.firstName || updates.lastName) {
                    update('name', [updates.firstName, updates.lastName].filter(Boolean).join(' '));
                }
                if ((updates as any).financialVitals?.budgetMax) {
                    update('budget', String((updates as any).financialVitals.budgetMax));
                }
                if ((updates as any).searchCriteria?.locations) {
                    update('targetLocations', (updates as any).searchCriteria.locations);
                }
                if ((updates as any).searchCriteria?.targetTimeline) {
                    update('targetTimeline', (updates as any).searchCriteria.targetTimeline);
                }
                if ((updates as any).searchCriteria?.personaProfile) {
                    update('personaProfile', (updates as any).searchCriteria.personaProfile);
                }
                if (updates.email) {
                    update('email', updates.email);
                }
                if (updates.phone) {
                    update('phone', updates.phone);
                }
                if ((updates as any).primaryContact?.preferredMethod) {
                    update('preferredMethod', (updates as any).primaryContact.preferredMethod);
                }
                setEditModalOpen(false);
            }}
        />
        </>
    );
};

export default StoryIntakeTab;
