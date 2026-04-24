/**
 * CommunityPulseSectionPage
 *
 * Full-page view of the CommunityPulseResult:
 *   Hero · Summary · 6 data sections (3-column grid)
 *   What Residents Like · Common Complaints · Safety & Concerns
 *   Schools & Family Friendliness · Lifestyle & Convenience · Investment Insights
 *   + Full analysis text from analysis.detailed_analysis.community_pulse
 */
import React from 'react';
import { CommunityPulseResult, CommunityPulseSection, ComprehensiveAnalysisResult } from '../../../types/ai';

interface Props {
    communityPulse: CommunityPulseResult | null;
    analysis?: ComprehensiveAnalysisResult | null;
    city?: string;
}

// ─── Type scale ────────────────────────────────────────────────────────────────
const T = {
    label:  'text-[10px] font-black text-slate-400 uppercase tracking-widest',
    body:   'text-[13px] font-medium text-slate-500 leading-relaxed',
    cardH:  'text-[16px] font-black text-slate-900 tracking-tight',
    attr:   'text-[9px] font-bold text-slate-300 uppercase tracking-widest',
};

// ─── Section card config ────────────────────────────────────────────────────────
interface SectionConfig {
    key: keyof CommunityPulseResult;
    label: string;
    icon: string;
    accentBg: string;
    accentText: string;
    pillBg: string;
    pillBorder: string;
    pillText: string;
    bulletIcon: string;
    bulletColor: string;
    badgeLabel?: string;
    badgeColor?: string;
}

const SECTIONS: SectionConfig[] = [
    {
        key: 'what_residents_like',
        label: 'What Residents Like',
        icon: 'fa-thumbs-up',
        accentBg: 'bg-emerald-50',
        accentText: 'text-emerald-600',
        pillBg: 'bg-emerald-50',
        pillBorder: 'border-emerald-100',
        pillText: 'text-emerald-900',
        bulletIcon: 'fa-check',
        bulletColor: 'text-emerald-400',
    },
    {
        key: 'common_complaints',
        label: 'Common Complaints',
        icon: 'fa-flag',
        accentBg: 'bg-rose-50',
        accentText: 'text-rose-600',
        pillBg: 'bg-rose-50',
        pillBorder: 'border-rose-200',
        pillText: 'text-rose-900',
        bulletIcon: 'fa-flag',
        bulletColor: 'text-rose-400',
        badgeLabel: 'FLAG',
        badgeColor: 'text-rose-500',
    },
    {
        key: 'safety_and_concerns',
        label: 'Safety & Concerns',
        icon: 'fa-shield-halved',
        accentBg: 'bg-slate-100',
        accentText: 'text-slate-600',
        pillBg: 'bg-slate-50',
        pillBorder: 'border-slate-200',
        pillText: 'text-slate-700',
        bulletIcon: 'fa-shield-halved',
        bulletColor: 'text-slate-400',
        badgeLabel: 'FLAG',
        badgeColor: 'text-rose-500',
    },
    {
        key: 'schools_family_friendliness',
        label: 'Schools & Families',
        icon: 'fa-graduation-cap',
        accentBg: 'bg-indigo-50',
        accentText: 'text-indigo-600',
        pillBg: 'bg-indigo-50',
        pillBorder: 'border-indigo-100',
        pillText: 'text-indigo-900',
        bulletIcon: 'fa-check',
        bulletColor: 'text-indigo-400',
    },
    {
        key: 'lifestyle_convenience',
        label: 'Lifestyle & Convenience',
        icon: 'fa-bus',
        accentBg: 'bg-violet-50',
        accentText: 'text-violet-600',
        pillBg: 'bg-violet-50',
        pillBorder: 'border-violet-100',
        pillText: 'text-violet-900',
        bulletIcon: 'fa-check',
        bulletColor: 'text-violet-400',
    },
    {
        key: 'investment_insights',
        label: 'Investment Insights',
        icon: 'fa-chart-line',
        accentBg: 'bg-amber-50',
        accentText: 'text-amber-600',
        pillBg: 'bg-amber-50',
        pillBorder: 'border-amber-100',
        pillText: 'text-amber-900',
        bulletIcon: 'fa-check',
        bulletColor: 'text-amber-500',
    },
];

// ─── Section Card ───────────────────────────────────────────────────────────────

const PulseSectionCard: React.FC<{ cfg: SectionConfig; data: CommunityPulseSection | undefined }> = ({ cfg, data }) => {
    if (!data) return null;
    return (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${cfg.accentBg} flex items-center justify-center shrink-0`}>
                        <i className={`fa-solid ${cfg.icon} ${cfg.accentText} text-[13px]`} />
                    </div>
                    <h2 className={T.cardH}>{cfg.label}</h2>
                </div>
                {cfg.badgeLabel && (
                    <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.badgeColor} flex items-center gap-1`}>
                        <i className="fa-solid fa-flag text-[9px]" /> {cfg.badgeLabel}
                    </span>
                )}
            </div>

            {/* Summary */}
            {data.summary && (
                <p className={`${T.body} border-b border-slate-100 pb-4`}>{data.summary}</p>
            )}

            {/* Points */}
            {data.points && data.points.length > 0 && (
                <div className="space-y-2">
                    {data.points.map((point, i) => (
                        <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${cfg.pillBg} ${cfg.pillBorder}`}>
                            <i className={`fa-solid ${cfg.bulletIcon} ${cfg.bulletColor} text-[10px] mt-1 flex-shrink-0`} />
                            <span className={`text-[13px] font-medium ${cfg.pillText} leading-snug`}>{point}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Sources */}
            {data.sources && data.sources.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                    <div className={`${T.label} mb-1`}>Knowledge Sources</div>
                    <div className={`text-[11px] font-medium text-blue-500 italic`}>
                        {data.sources.join(', ')}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export const CommunityPulseSectionPage: React.FC<Props> = ({ communityPulse: cp, analysis, city }) => {
    const fallbackText = analysis?.detailed_analysis?.community_pulse;

    if (!cp && !fallbackText) {
        return (
            <div className="bg-white rounded-3xl border border-slate-200/60 p-12 shadow-sm text-center">
                <i className="fa-solid fa-users text-slate-200 text-[40px] mb-4" />
                <div className={`${T.cardH} text-slate-400 mb-2`}>No Community Data Yet</div>
                <p className={`${T.body} max-w-xs mx-auto`}>
                    Community Pulse is generated from resident reviews and local data sources. Run an analysis to populate this section.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">



            {/* ── Full analysis text (if available) ─────────────────── */}
            {fallbackText && (
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-file-lines text-blue-400 text-[12px]" />
                        <span className={`${T.label} text-blue-500`}>Full Analysis Overview</span>
                    </div>
                    <p className="text-[14px] text-slate-600 leading-relaxed font-medium">
                        {fallbackText.split(/\*\*(.*?)\*\*/g).map((chunk: string, j: number) =>
                            j % 2 === 1 ? <strong key={j} className="font-black text-slate-900">{chunk}</strong> : chunk
                        )}
                    </p>
                </div>
            )}

            {/* ── 6-section grid ─────────────────────────────────────── */}
            {cp && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {SECTIONS.map(cfg => (
                        <PulseSectionCard
                            key={cfg.key}
                            cfg={cfg}
                            data={(cp as any)[cfg.key]}
                        />
                    ))}
                </div>
            )}

        </div>
    );
};
