import React, { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Motivation = 'lifestyle' | 'investment' | 'downsizing' | 'upsizing' | 'relocation';
type Timeline = 'urgent' | '3months' | '6months' | 'flexible';
type InvestmentTier = 'first_home' | 'move_up' | 'high_net_worth' | 'investor';

interface StoryIntakeData {
    // Realtor-visible
    primaryStakeholder: string;
    investmentTier: InvestmentTier;
    motivation: Motivation;
    timeline: Timeline;
    realtorNotes: string;

    // Shared client + realtor
    narrative: string;
    budgetMin: string;
    budgetMax: string;
    beds: string;
    baths: string;
    selectedAnchors: string[];
    customAnchor: string;
}

interface Props {
    isRealtor?: boolean;
    onMatchRequest?: (story: string, filters: { budgetMin: string; budgetMax: string; beds: string; baths: string }) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ATMOSPHERIC_ANCHORS = [
    { id: 'walkable_coffee', label: 'Walking Distance to Coffee', icon: 'fa-mug-hot' },
    { id: 'quiet_streets', label: 'Quiet Streets', icon: 'fa-moon' },
    { id: 'mid_century', label: 'Mid-Century Aesthetic', icon: 'fa-house-chimney' },
    { id: 'top_schools', label: 'Top-Rated Schools', icon: 'fa-graduation-cap' },
    { id: 'large_backyard', label: 'Large Backyard', icon: 'fa-tree' },
    { id: 'home_office', label: 'Home Office Ready', icon: 'fa-laptop-house' },
    { id: 'pet_parks', label: 'Pet-Friendly Parks', icon: 'fa-dog' },
    { id: 'low_wildfire', label: 'Low Wildfire Risk', icon: 'fa-fire-flame-simple' },
    { id: 'tech_commute', label: 'Tech Commute Access', icon: 'fa-road' },
    { id: 'private_security', label: 'Private / Gated', icon: 'fa-shield-halved' },
    { id: 'grocery', label: 'Gourmet Grocery Access', icon: 'fa-basket-shopping' },
    { id: 'sustainable', label: 'Sustainable Architecture', icon: 'fa-leaf' },
    { id: 'modern_kitchen', label: 'Modern Kitchen', icon: 'fa-utensils' },
    { id: 'natural_light', label: 'Natural Light / Open Plan', icon: 'fa-sun' },
    { id: 'vastu', label: 'Vastu / Good Orientation', icon: 'fa-compass' },
];

const INVESTMENT_TIER_LABELS: Record<InvestmentTier, string> = {
    first_home: 'First Home Buyer',
    move_up: 'Move-Up Buyer',
    high_net_worth: 'High Net Worth (HNW)',
    investor: 'Investment Portfolio',
};

const MOTIVATION_LABELS: Record<Motivation, { label: string; icon: string }> = {
    lifestyle: { label: 'Lifestyle Upgrade', icon: 'fa-star' },
    investment: { label: 'Investment / Yield', icon: 'fa-chart-line' },
    downsizing: { label: 'Downsizing', icon: 'fa-compress' },
    upsizing: { label: 'Upsizing / Growing Family', icon: 'fa-people-group' },
    relocation: { label: 'Relocation', icon: 'fa-plane' },
};

const TIMELINE_LABELS: Record<Timeline, { label: string; color: string }> = {
    urgent: { label: '< 30 Days', color: 'text-rose-600 bg-rose-50 border-rose-200' },
    '3months': { label: '1–3 Months', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    '6months': { label: '3–6 Months', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    flexible: { label: 'Flexible', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${className}`}>
            {children}
        </div>
    );
}

function SectionHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                    <i className={`fa-solid ${icon} text-indigo-500 text-xs`}></i>
                </div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight">{title}</h2>
            </div>
            {badge && (
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                    {badge}
                </span>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const StoryIntakeTab: React.FC<Props> = ({ isRealtor = false, onMatchRequest }) => {
    const [data, setData] = useState<StoryIntakeData>({
        primaryStakeholder: '',
        investmentTier: 'move_up',
        motivation: 'lifestyle',
        timeline: 'flexible',
        realtorNotes: '',
        narrative: '',
        budgetMin: '',
        budgetMax: '',
        beds: '',
        baths: '',
        selectedAnchors: [],
        customAnchor: '',
    });

    const [synthesizing, setSynthesizing] = useState(false);
    const [saved, setSaved] = useState(false);

    const update = useCallback(<K extends keyof StoryIntakeData>(key: K, value: StoryIntakeData[K]) => {
        setData(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    }, []);

    const toggleAnchor = (id: string) => {
        setData(prev => ({
            ...prev,
            selectedAnchors: prev.selectedAnchors.includes(id)
                ? prev.selectedAnchors.filter(a => a !== id)
                : [...prev.selectedAnchors, id],
        }));
        setSaved(false);
    };

    const addCustomAnchor = () => {
        const trimmed = data.customAnchor.trim();
        if (!trimmed) return;
        setData(prev => ({
            ...prev,
            selectedAnchors: [...prev.selectedAnchors, `custom:${trimmed}`],
            customAnchor: '',
        }));
    };

    const handleSynthesize = async () => {
        setSynthesizing(true);
        await new Promise(r => setTimeout(r, 1200)); // simulate
        setSynthesizing(false);
        setSaved(true);
        if (onMatchRequest) {
            onMatchRequest(data.narrative, {
                budgetMin: data.budgetMin,
                budgetMax: data.budgetMax,
                beds: data.beds,
                baths: data.baths,
            });
        }
    };

    const handleSaveProgress = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="animate-in fade-in duration-400 max-w-5xl mx-auto px-4 py-6 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">
                        Client Profile
                    </p>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                        Client Story Intake
                    </h1>
                    {isRealtor && (
                        <p className="text-xs text-slate-400 mt-1 font-medium">
                            Capture the full client picture to power AI property matching.
                        </p>
                    )}
                </div>
                {isRealtor && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleSynthesize}
                            disabled={synthesizing}
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-60"
                        >
                            {synthesizing ? (
                                <i className="fa-solid fa-spinner animate-spin text-xs"></i>
                            ) : (
                                <i className="fa-solid fa-bolt text-xs"></i>
                            )}
                            Synthesize Match
                        </button>
                    </div>
                )}
            </div>

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* ── Client Profile (Realtor-only) ── */}
                {isRealtor && (
                    <SectionCard>
                        <SectionHeader icon="fa-id-card" title="Client Profile" />
                        <div className="px-6 py-5 space-y-5">

                            {/* Primary Stakeholder */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">
                                    Primary Stakeholder
                                </label>
                                <input
                                    type="text"
                                    value={data.primaryStakeholder}
                                    onChange={e => update('primaryStakeholder', e.target.value)}
                                    placeholder="e.g. Eleanor & James Vance"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                                />
                            </div>

                            {/* Investment Tier */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">
                                    Investment Tier
                                </label>
                                <select
                                    value={data.investmentTier}
                                    onChange={e => update('investmentTier', e.target.value as InvestmentTier)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                                >
                                    {(Object.entries(INVESTMENT_TIER_LABELS) as [InvestmentTier, string][]).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Primary Motivation */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2.5">
                                    Primary Motivation
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {(Object.entries(MOTIVATION_LABELS) as [Motivation, { label: string; icon: string }][]).map(([k, v]) => (
                                        <button
                                            key={k}
                                            onClick={() => update('motivation', k)}
                                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${data.motivation === k
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                                }`}
                                        >
                                            <i className={`fa-solid ${v.icon} text-[9px]`}></i>
                                            {v.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Timeline */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2.5">
                                    Purchase Timeline
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {(Object.entries(TIMELINE_LABELS) as [Timeline, { label: string; color: string }][]).map(([k, v]) => (
                                        <button
                                            key={k}
                                            onClick={() => update('timeline', k)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${data.timeline === k
                                                ? `${v.color} font-black border-current shadow-sm`
                                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                                }`}
                                        >
                                            {v.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Market Fit Estimator (read-only insight) */}
                            {data.motivation && data.investmentTier && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3.5">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <i className="fa-solid fa-chart-bar text-indigo-500 text-xs"></i>
                                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.18em]">
                                            Market Fit Estimator
                                        </span>
                                    </div>
                                    <p className="text-xs text-indigo-800 font-medium leading-relaxed">
                                        {data.motivation === 'investment'
                                            ? <>Profile suggests <span className="font-black text-indigo-700">yield-first</span> properties. Prioritizing cap rate and rental demand over aesthetics.</>
                                            : data.motivation === 'lifestyle'
                                                ? <>Profile indicates preference for <span className="font-black text-indigo-700">long-term equity</span>. Recommendations will weight neighborhood character and school quality.</>
                                                : data.motivation === 'relocation'
                                                    ? <>Relocation buyer — optimize for <span className="font-black text-indigo-700">commute efficiency</span> and fast-close inventory.</>
                                                    : <>Move-up buyer — prioritize <span className="font-black text-indigo-700">size, schools, and curb appeal</span> within tier budget.</>
                                        }
                                    </p>
                                </div>
                            )}
                        </div>
                    </SectionCard>
                )}

                {/* ── Client Narrative ── */}
                <SectionCard className={isRealtor ? '' : 'lg:col-span-2'}>
                    <SectionHeader icon="fa-book-open" title="Your Story" badge="Natural Language" />
                    <div className="px-6 py-5 flex flex-col h-full">
                        <p className="text-xs text-slate-400 font-medium mb-3 leading-relaxed">
                            {isRealtor
                                ? "Capture the client's daily ritual, lifestyle needs, and emotional connection to their ideal home."
                                : "Tell us about yourself and what you're looking for. Be as specific or open-ended as you'd like."
                            }
                        </p>
                        <textarea
                            value={data.narrative}
                            onChange={e => update('narrative', e.target.value)}
                            placeholder={isRealtor
                                ? "e.g. Eleanor & James are a dual-income tech couple with 2 young kids. They want top-rated schools, a quiet cul-de-sac, a modern kitchen, and a home office. Budget is $1.8M. They are sensitive to wildfire risk and low Vastu score..."
                                : "Example: I'm a software engineer with a young family. We love cooking and need a great school district. Budget is around $1.5M. We love natural light and big backyards. Low wildfire risk is important to us..."
                            }
                            rows={7}
                            className="w-full resize-none px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all leading-relaxed"
                        />
                        <div className="flex items-center justify-between mt-3">
                            <span className="text-[10px] text-slate-400 font-medium">
                                {data.narrative.length > 0
                                    ? `${data.narrative.split(/\s+/).filter(Boolean).length} words`
                                    : 'Start typing your story...'
                                }
                            </span>
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-microphone text-slate-300 text-sm"></i>
                                <i className="fa-solid fa-paperclip text-slate-300 text-sm"></i>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            </div>

            {/* ── Budget & Requirements ── */}
            <SectionCard>
                <SectionHeader icon="fa-sliders" title="Requirements" badge="Property Filters" />
                <div className="px-6 py-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Min Budget</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                <input
                                    type="text"
                                    value={data.budgetMin}
                                    onChange={e => update('budgetMin', e.target.value)}
                                    placeholder="1,000,000"
                                    className="w-full pl-7 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Max Budget</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                <input
                                    type="text"
                                    value={data.budgetMax}
                                    onChange={e => update('budgetMax', e.target.value)}
                                    placeholder="1,800,000"
                                    className="w-full pl-7 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Min Beds</label>
                            <select
                                value={data.beds}
                                onChange={e => update('beds', e.target.value)}
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            >
                                <option value="">Any</option>
                                {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}+</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mb-2">Min Baths</label>
                            <select
                                value={data.baths}
                                onChange={e => update('baths', e.target.value)}
                                className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                            >
                                <option value="">Any</option>
                                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* ── Atmospheric Anchors ── */}
            <SectionCard>
                <SectionHeader icon="fa-waveform-lines" title="Atmospheric Anchors" badge="Select Lifestyle Signatures" />
                <div className="px-6 py-5">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {ATMOSPHERIC_ANCHORS.map(anchor => {
                            const isSelected = data.selectedAnchors.includes(anchor.id);
                            return (
                                <button
                                    key={anchor.id}
                                    onClick={() => toggleAnchor(anchor.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-bold transition-all border ${isSelected
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                                        }`}
                                >
                                    {isSelected
                                        ? <i className="fa-solid fa-check text-[9px]"></i>
                                        : <i className={`fa-solid ${anchor.icon} text-[9px]`}></i>
                                    }
                                    {anchor.label}
                                </button>
                            );
                        })}

                        {/* Custom anchors */}
                        {data.selectedAnchors.filter(a => a.startsWith('custom:')).map(a => {
                            const label = a.replace('custom:', '');
                            return (
                                <button
                                    key={a}
                                    onClick={() => toggleAnchor(a)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-bold bg-indigo-700 text-white border-2 border-indigo-600 transition-all"
                                >
                                    <i className="fa-solid fa-check text-[9px]"></i>
                                    {label}
                                </button>
                            );
                        })}

                        {/* Add custom anchor input */}
                        <div className="flex items-center gap-1 border border-dashed border-slate-300 rounded-2xl overflow-hidden pl-3 pr-1 py-1">
                            <i className="fa-solid fa-wand-magic-sparkles text-slate-300 text-[9px]"></i>
                            <input
                                type="text"
                                value={data.customAnchor}
                                onChange={e => update('customAnchor', e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAnchor(); } }}
                                placeholder="Custom anchor..."
                                className="bg-transparent text-[11px] font-medium text-slate-600 placeholder:text-slate-300 outline-none w-28"
                            />
                            {data.customAnchor.trim() && (
                                <button
                                    onClick={addCustomAnchor}
                                    className="px-2 py-1 bg-indigo-500 text-white rounded-xl text-[9px] font-black"
                                >
                                    Add
                                </button>
                            )}
                        </div>
                    </div>
                    {data.selectedAnchors.length > 0 && (
                        <p className="text-[10px] text-slate-400 font-medium">
                            {data.selectedAnchors.length} anchor{data.selectedAnchors.length > 1 ? 's' : ''} selected
                        </p>
                    )}
                </div>
            </SectionCard>

            {/* ── Realtor Notes (realtor-only) ── */}
            {isRealtor && (
                <SectionCard>
                    <SectionHeader icon="fa-clipboard" title="Realtor Notes" badge="Internal Only" />
                    <div className="px-6 py-5">
                        <textarea
                            value={data.realtorNotes}
                            onChange={e => update('realtorNotes', e.target.value)}
                            placeholder="Internal notes: objections heard, price flexibility, competing agents, preferred neighborhoods, deal breakers..."
                            rows={4}
                            className="w-full resize-none px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition-all leading-relaxed"
                        />
                    </div>
                </SectionCard>
            )}

            {/* ── Footer CTA ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <i className="fa-solid fa-magnifying-glass-chart text-indigo-600 text-sm"></i>
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900">Portfolio Matching Strategy</div>
                        <div className="text-[10px] text-slate-400 font-medium truncate">
                            {data.selectedAnchors.length > 0 || data.narrative.length > 20
                                ? `${data.selectedAnchors.length} anchors · ${data.narrative.split(/\s+/).filter(Boolean).length} words of narrative captured`
                                : 'Complete your story above to match properties'
                            }
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={handleSaveProgress}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${saved
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                    >
                        {saved ? (
                            <><i className="fa-solid fa-check mr-1.5"></i>Saved</>
                        ) : (
                            <><i className="fa-regular fa-floppy-disk mr-1.5"></i>Save Progress</>
                        )}
                    </button>
                    <button
                        onClick={handleSynthesize}
                        disabled={synthesizing || (!data.narrative && data.selectedAnchors.length === 0)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg hover:bg-indigo-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {synthesizing ? (
                            <><i className="fa-solid fa-spinner animate-spin text-xs"></i>Finding matches...</>
                        ) : (
                            <><i className="fa-solid fa-wand-magic-sparkles text-xs"></i>Find My Match</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StoryIntakeTab;
