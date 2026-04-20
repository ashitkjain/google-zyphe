/**
 * PropertyLifestylePanel
 *
 * Renders the Lifestyle Fit & Interests cards on the property Overview tab.
 * Extracted from ExploreRow2Cards.tsx for clarity and maintainability.
 */
import React from 'react';

interface PropertyLifestylePanelProps {
    lifestyleFit: any;
    lifestyleInsights: any;
    lifestyleLoading: boolean;
    lifestyleFitTab: string;
    setLifestyleFitTab: (tab: string) => void;
    lifestyleInterestTab: string;
    setLifestyleInterestTab: (tab: string) => void;
    handleGenerateLifestyle: () => void;
    /** If provided, only renders matching cards: 'fit' | 'interests' */
    showOnly?: string[];
}

export const PropertyLifestylePanel: React.FC<PropertyLifestylePanelProps> = ({
    lifestyleFit,
    lifestyleInsights,
    lifestyleLoading,
    lifestyleFitTab,
    setLifestyleFitTab,
    lifestyleInterestTab,
    setLifestyleInterestTab,
    handleGenerateLifestyle,
    showOnly,
}) => {
    const show = (key: string) => !showOnly || showOnly.includes(key);
    const FIT_TABS = [
        { key: 'working_professionals', label: 'Working Professionals', icon: 'fa-briefcase', bg: 'bg-sky-100', text: 'text-sky-600' },
        { key: 'families_with_kids', label: 'Families with Kids', icon: 'fa-children', bg: 'bg-blue-100', text: 'text-blue-600' },
        { key: 'seniors', label: 'Seniors', icon: 'fa-heart-pulse', bg: 'bg-rose-100', text: 'text-rose-600' },
    ];
    const INTEREST_TABS = [
        { key: 'outdoor', label: 'Outdoor & Recreation', icon: 'fa-mountain-sun', bg: 'bg-emerald-100', text: 'text-emerald-600' },
        { key: 'pets', label: 'Pet Friendly', icon: 'fa-paw', bg: 'bg-amber-100', text: 'text-amber-600' },
        { key: 'food', label: 'Food & Entertainment', icon: 'fa-utensils', bg: 'bg-violet-100', text: 'text-violet-600' },
    ];

    const verdictColors: Record<string, string> = {
        'Excellent Fit': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Good Fit': 'bg-sky-100 text-sky-700 border-sky-200',
        'Moderate Fit': 'bg-amber-100 text-amber-700 border-amber-200',
        'Poor Fit': 'bg-orange-100 text-orange-700 border-orange-200',
        'Not Recommended': 'bg-rose-100 text-rose-700 border-rose-200',
    };

    const hasFitData = lifestyleFit && (lifestyleFit.working_professionals || lifestyleFit.families_with_kids || lifestyleFit.seniors);
    const hasInterestData = lifestyleInsights && (lifestyleInsights.outdoor || lifestyleInsights.pets || lifestyleInsights.food);
    if (!hasFitData && !hasInterestData && !lifestyleLoading) return null;

    const activeFit = FIT_TABS.find(t => t.key === lifestyleFitTab) || FIT_TABS[0];
    const activeInterest = INTEREST_TABS.find(t => t.key === lifestyleInterestTab) || INTEREST_TABS[0];

    const renderTabButton = (tab: any, activeKey: string, setKey: (k: string) => void, isFit: boolean) => {
        const isActive = tab.key === activeKey;
        const hasContent = isFit
            ? (!!lifestyleFit?.[tab.key] || lifestyleLoading)
            : (!!lifestyleInsights?.[tab.key as keyof typeof lifestyleInsights] || lifestyleLoading);
        const fitData = isFit ? lifestyleFit?.[tab.key] : null;

        return (
            <button
                key={tab.key}
                onClick={() => setKey(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all text-left ${isActive
                    ? `${tab.bg} border-current ${tab.text} shadow-md ring-2 ring-current ring-offset-1`
                    : hasContent
                        ? 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer shadow-sm'
                        : 'bg-slate-50 border-slate-200 opacity-40 cursor-not-allowed'
                    }`}
                disabled={!hasContent}
            >
                <i className={`fa-solid ${tab.icon} ${tab.text} text-[14px]`} />
                <span className={`text-[13px] font-black whitespace-nowrap ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>{tab.label}</span>
                {fitData?.verdict && (
                    <span className={`ml-2 px-2 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-wider ${verdictColors[fitData.verdict] || 'bg-slate-100 text-slate-500'}`}>
                        {fitData.verdict}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div id="ov-lifestyle" className="flex flex-col gap-1 w-full scroll-mt-20 select-none">
            <div className="flex flex-col xl:flex-row gap-8 w-full">

                {/* Lifestyle Fit */}
                {show('fit') && (
                <div className="flex-1 xl:flex-[3] flex flex-col bg-slate-50 rounded-2xl border-2 border-indigo-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="p-3 flex-1 flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shadow-sm">
                                <i className="fa-solid fa-people-arrows text-indigo-600 text-[14px]" />
                            </div>
                            <h3 className="text-[18px] font-black text-slate-900 tracking-tight">Lifestyle Fit</h3>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {FIT_TABS.map(t => renderTabButton(t, lifestyleFitTab, setLifestyleFitTab, true))}
                        </div>

                        <div className="flex-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden p-4">
                            {(() => {
                                const fitData = lifestyleFit?.[lifestyleFitTab];
                                if (!fitData) return lifestyleLoading ? (
                                    <div className="space-y-4">
                                        <div className="h-6 w-32 bg-slate-100 rounded animate-pulse" />
                                        <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="h-20 bg-slate-50 rounded animate-pulse" />
                                            <div className="h-20 bg-slate-50 rounded animate-pulse" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400">
                                        <i className={`fa-solid ${activeFit.icon} text-2xl mb-2 opacity-20`} />
                                        <div className="text-[12px] font-bold">No fit analysis available</div>
                                    </div>
                                );

                                return (
                                    <div className="flex flex-col gap-3">
                                        <p className="text-[15.5px] text-slate-700 leading-relaxed font-sans font-medium">{fitData.summary}</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {fitData.strengths?.length > 0 && (
                                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm">
                                                    <div className="text-[11.5px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <i className="fa-solid fa-circle-check text-[14px]" /> Pros
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {fitData.strengths.map((s: string, i: number) => (
                                                            <div key={i} className="flex items-start gap-2.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                                                                <span className="text-[15px] text-slate-700 leading-snug font-sans font-medium">{s}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {fitData.concerns?.length > 0 && (
                                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 shadow-sm">
                                                    <div className="text-[11.5px] font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                        <i className="fa-solid fa-triangle-exclamation text-[14px]" /> Cons
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        {fitData.concerns.map((c: string, i: number) => (
                                                            <div key={i} className="flex items-start gap-2.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                                                                <span className="text-[15px] text-slate-700 leading-snug font-sans font-medium">{c}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {fitData.tip && (
                                            <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm">
                                                <i className="fa-solid fa-lightbulb text-[15px] text-indigo-400 mt-1" />
                                                <span className="text-[15px] text-indigo-700 leading-relaxed font-sans font-medium">{fitData.tip}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
                )}{/* end Lifestyle Fit */}

                {/* Interests — 3 cards side by side */}
                {show('interests') && (
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="flex items-center gap-3 px-1">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shadow-sm">
                                <i className="fa-solid fa-star text-emerald-600 text-[14px]" />
                            </div>
                            <h3 className="text-[18px] font-black text-slate-900 tracking-tight">Interests</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {INTEREST_TABS.map(t => {
                                const text = lifestyleInsights?.[t.key as keyof typeof lifestyleInsights];
                                return (
                                    <div key={t.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                                        {/* Header */}
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-lg ${t.bg} flex items-center justify-center shrink-0`}>
                                                <i className={`fa-solid ${t.icon} ${t.text} text-[13px]`} />
                                            </div>
                                            <span className="text-[13px] font-black text-slate-800 leading-tight">{t.label}</span>
                                        </div>
                                        {/* Content */}
                                        {text ? (
                                            <p className="text-[14px] text-slate-600 leading-relaxed font-sans font-medium">
                                                {String(text).split(/\*\*(.*?)\*\*/g).map((chunk: string, j: number) => (
                                                    j % 2 === 1
                                                        ? <strong key={j} className={`font-black ${t.text}`}>{chunk}</strong>
                                                        : chunk
                                                ))}
                                            </p>
                                        ) : lifestyleLoading ? (
                                            <div className="space-y-2">
                                                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                                                <div className="h-3 w-5/6 bg-slate-100 rounded animate-pulse" />
                                                <div className="h-3 w-4/6 bg-slate-100 rounded animate-pulse" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-4 text-center text-slate-300">
                                                <i className={`fa-solid ${t.icon} text-xl mb-1.5 opacity-30`} />
                                                <div className="text-[11px] font-bold">No insights yet</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}{/* end Interests */}

            </div>
            <div className="text-[8px] text-slate-500 mt-1 px-4 text-right">MLS + AI Photo Analysis • Google Places • Gemini</div>
        </div>
    );
};
