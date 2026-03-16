import React, { useState } from 'react';
import { LIFESTYLE_TOPICS } from '../../prompts/property/lifestyleInsights';
import type { LifestyleInsightsResult } from '../../services/geminiService';

interface Props {
    insights: LifestyleInsightsResult | null;
    loading?: boolean;
    onGenerate?: () => void;
}

const LifestyleInsightsSection: React.FC<Props> = ({ insights, loading, onGenerate }) => {
    // Filter topics to only those with data in the provided insights
    const availableTopics = insights
        ? LIFESTYLE_TOPICS.filter(t => !!insights[t.key as keyof LifestyleInsightsResult])
        : LIFESTYLE_TOPICS;
    const [activeKey, setActiveKey] = useState<string>(LIFESTYLE_TOPICS[0].key);
    // Auto-select first available topic if current selection is not in list
    const effectiveKey = availableTopics.find(t => t.key === activeKey) ? activeKey : availableTopics[0]?.key;
    const activeTopic = LIFESTYLE_TOPICS.find(t => t.key === effectiveKey) || LIFESTYLE_TOPICS[0];

    /* ── Shared tab grid (icon-centered, label below) ── */
    const renderTabGrid = (opts: { interactive?: boolean; skeleton?: boolean }) => (
        <div className="grid grid-cols-3 gap-2" style={{ flex: '2 1 0%' }}>
            {(opts.skeleton ? LIFESTYLE_TOPICS : availableTopics).map(t => {
                if (opts.skeleton) {
                    return (
                        <div key={t.key} className="flex flex-col items-center gap-1.5 p-3 bg-slate-50/50 rounded-xl border border-slate-100 animate-pulse">
                            <div className="w-8 h-8 rounded-lg bg-slate-200"></div>
                            <div className="w-14 h-2 bg-slate-200 rounded-full"></div>
                        </div>
                    );
                }

                const isActive = opts.interactive && t.key === effectiveKey;
                const hasContent = opts.interactive ? !!insights?.[t.key as keyof LifestyleInsightsResult] : false;

                return (
                    <button
                        key={t.key}
                        onClick={() => opts.interactive && setActiveKey(t.key)}
                        disabled={opts.interactive && !hasContent}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                            isActive
                                ? `${t.bg} border-current ${t.text} shadow-sm`
                                : opts.interactive && hasContent
                                    ? 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 cursor-pointer'
                                    : opts.interactive
                                        ? 'bg-slate-50/30 border-slate-100 opacity-40 cursor-not-allowed'
                                        : 'bg-slate-50/50 border-slate-100'
                        }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isActive ? 'bg-white/60' : t.bg
                        }`}>
                            <i className={`fa-solid ${t.icon} ${t.text} text-[12px]`}></i>
                        </div>
                        <span className={`text-[10px] font-bold leading-tight text-center ${
                            isActive ? 'text-slate-900' : 'text-slate-500'
                        }`}>{t.label}</span>
                    </button>
                );
            })}
        </div>
    );

    // ── Empty state (no insights, not loading) ──
    if (!insights && !loading) {
        return (
            <div className="w-full px-2 rounded-2xl border-2 border-emerald-200 overflow-hidden">
                <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <i className="fa-solid fa-sparkles text-emerald-600 text-sm"></i>
                            </div>
                            <div>
                                <span className="text-[16px] font-black text-slate-700 tracking-tight">Neighborhood Lifestyle Fit</span>
                                <div className="text-[10px] text-slate-400">Personalized analysis for different buyer profiles</div>
                            </div>
                        </div>
                        {onGenerate && (
                            <button
                                onClick={onGenerate}
                                className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-[12px] font-bold hover:bg-emerald-600 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles text-[11px]"></i>
                                Generate
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        {renderTabGrid({ interactive: false })}
                        <div className="flex-1 bg-slate-50/30 rounded-xl border border-slate-100 p-8 flex flex-col items-center justify-center text-center">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                                <i className="fa-solid fa-wand-magic-sparkles text-emerald-500 text-sm"></i>
                            </div>
                            <div className="text-[12px] font-bold text-slate-400">Click Generate to analyze this neighborhood for different lifestyles</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Loading state ──
    if (loading) {
        return (
            <div className="w-full px-2 rounded-2xl border-2 border-emerald-200 overflow-hidden">
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <i className="fa-solid fa-sparkles text-emerald-600 text-sm animate-pulse"></i>
                        </div>
                        <div>
                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Neighborhood Lifestyle Fit</span>
                            <div className="text-[10px] text-emerald-500 animate-pulse">Analyzing neighborhood for different lifestyles...</div>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        {renderTabGrid({ skeleton: true })}
                        <div className="flex-1 bg-slate-50/30 rounded-xl border border-slate-100/80 p-5 animate-pulse">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-slate-200"></div>
                                <div className="w-32 h-4 bg-slate-200 rounded-full"></div>
                            </div>
                            <div className="space-y-2.5">
                                <div className="w-full h-2.5 bg-slate-200 rounded-full"></div>
                                <div className="w-full h-2.5 bg-slate-200 rounded-full"></div>
                                <div className="w-full h-2.5 bg-slate-200 rounded-full"></div>
                                <div className="w-5/6 h-2.5 bg-slate-200 rounded-full"></div>
                                <div className="w-3/4 h-2.5 bg-slate-200 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Tabbed view with insights ──
    const activeText = insights?.[activeTopic.key as keyof LifestyleInsightsResult];

    return (
        <div className="w-full px-2 rounded-2xl border-2 border-emerald-200 overflow-hidden">
            <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <i className="fa-solid fa-sparkles text-emerald-600 text-sm"></i>
                        </div>
                        <div>
                            <span className="text-[16px] font-black text-slate-700 tracking-tight">Neighborhood Lifestyle Fit</span>
                            <div className="text-[10px] text-slate-400">Personalized analysis for different buyer profiles</div>
                        </div>
                    </div>
                    {onGenerate && (
                        <button
                            onClick={onGenerate}
                            className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-500 hover:bg-emerald-100 transition-all"
                            title="Regenerate"
                        >
                            <i className="fa-solid fa-arrows-rotate text-[10px]"></i>
                        </button>
                    )}
                </div>

                {/* Tabbed layout: tabs (left) + content (right) */}
                <div className="flex gap-4">
                    {renderTabGrid({ interactive: true })}

                    {/* Content panel */}
                    <div style={{ flex: '3 1 0%' }} className="min-w-0">
                        {activeText ? (
                            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden h-full">
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`w-7 h-7 rounded-lg ${activeTopic.bg} flex items-center justify-center`}>
                                            <i className={`fa-solid ${activeTopic.icon} ${activeTopic.text} text-[11px]`}></i>
                                        </div>
                                        <span className="text-[16px] font-black text-slate-700 tracking-tight">{activeTopic.label}</span>
                                    </div>
                                    <p className="text-[13px] text-slate-600 leading-relaxed text-left">
                                        {String(activeText).split(/\*\*(.*?)\*\*/g).map((chunk: string, j: number) => (
                                            j % 2 === 1 ? <strong key={j} className="font-black text-slate-900">{chunk}</strong> : chunk
                                        ))}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50/30 rounded-xl border border-slate-100 p-8 flex flex-col items-center justify-center h-full text-center">
                                <div className={`w-10 h-10 rounded-full ${activeTopic.bg} flex items-center justify-center mb-3`}>
                                    <i className={`fa-solid ${activeTopic.icon} ${activeTopic.text} text-sm`}></i>
                                </div>
                                <div className="text-[12px] font-bold text-slate-400">No insights available for {activeTopic.label}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-[8px] text-slate-700 mt-2 text-right">Google Places + Gemini</div>
            </div>
        </div>
    );
};

export default LifestyleInsightsSection;
