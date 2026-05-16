import React, { useState, useMemo } from 'react';
import { ContextGraphExtractionResult } from '../../../../types';
import {
    FACTOR_NAMES,
    expandFactor,
    resolveFactor,
    DELETED_FACTOR_IDS,
    ExtractedFactor
} from '../../../../constants/contextGraphFactors';
import {
    resolveTaxonomySignalsFromFactors,
    tagsByZone,
    type TagZone,
    type TaxonomySignal,
} from '../../../../utils/propertyTaxonomy';
import { SCORING_MODELS, type ScoringResult } from '../../../../utils/scoringModels';

/** Maps a factor-table bucket key to a PROPERTY_TAXONOMY zone, where one exists. */
const BUCKET_TO_TAXONOMY_ZONE: Record<string, TagZone> = {
    architecture: 'architecture_entry',
    culinary:     'culinary',
    living:       'living_entertaining',
    sanctuary:    'primary_sanctuary',
    wellness:     'shower_wellness',
    outdoor:      'outdoor_grounds',
    // Context buckets (quality/systems/connectivity/lifestyle/climate/investment) have no zone counterpart.
};

interface Props {
    data: ContextGraphExtractionResult;
    loading: boolean;
    onExtract: () => void;
}

type BucketGroup = 'home' | 'context';

const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string; group: BucketGroup }> = {
    // ── Home Feature Buckets (mirror PROPERTY_TAXONOMY zones) ───────────────
    architecture: { label: 'Architecture & Curb Appeal', icon: 'fa-building-columns', color: 'amber',   group: 'home' },
    culinary:     { label: 'Culinary',                   icon: 'fa-utensils',         color: 'rose',    group: 'home' },
    living:       { label: 'Living & Entertainment',     icon: 'fa-couch',            color: 'fuchsia', group: 'home' },
    sanctuary:    { label: 'Primary Sanctuary',          icon: 'fa-bed',              color: 'violet',  group: 'home' },
    wellness:     { label: 'Shower & Wellness',          icon: 'fa-bath',             color: 'indigo',  group: 'home' },
    outdoor:      { label: 'Outdoor & Grounds',          icon: 'fa-tree',             color: 'teal',    group: 'home' },
    // ── Cross-Cutting Context Buckets ──────────────────────────────────────
    quality:      { label: 'Quality & Condition',        icon: 'fa-gem',              color: 'slate',   group: 'context' },
    systems:      { label: 'Home Systems & Energy',      icon: 'fa-bolt',             color: 'cyan',    group: 'context' },
    connectivity: { label: 'Connectivity & Commute',     icon: 'fa-route',            color: 'blue',    group: 'context' },
    lifestyle:    { label: 'Lifestyle & Community',      icon: 'fa-people-group',     color: 'emerald', group: 'context' },
    climate:      { label: 'Climate & Environment',      icon: 'fa-cloud-sun',        color: 'lime',    group: 'context' },
    investment:   { label: 'Investment & Market',        icon: 'fa-chart-line',       color: 'orange',  group: 'context' },
};

/**
 * Explicit factor → bucket mapping. One entry per non-deleted factor.
 * Keeps factor IDs/data unchanged — only changes the UI grouping.
 */
const FACTOR_TO_BUCKET: Record<number, string> = {
    // Architecture & Curb Appeal
    14: 'architecture', 19: 'architecture', 20: 'architecture', 23: 'architecture',
    34: 'architecture', 38: 'architecture', 41: 'architecture', 51: 'architecture',
    94: 'architecture', 95: 'architecture', 97: 'architecture', 104: 'architecture',
    108: 'architecture',
    // Culinary
    26: 'culinary',
    // Living & Entertainment
    17: 'living', 24: 'living', 25: 'living', 29: 'living', 59: 'living',
    114: 'living', 116: 'living',
    // Primary Sanctuary
    58: 'sanctuary',
    // Wellness & Spa
    27: 'wellness',
    // Outdoor & Grounds
    6: 'outdoor', 31: 'outdoor', 32: 'outdoor', 33: 'outdoor', 35: 'outdoor',
    36: 'outdoor', 39: 'outdoor', 40: 'outdoor', 54: 'outdoor', 68: 'outdoor',
    96: 'outdoor', 109: 'outdoor',
    // Quality & Condition (cross-zone interior quality)
    21: 'quality', 22: 'quality', 28: 'quality', 30: 'quality', 67: 'quality',
    100: 'quality', 113: 'quality', 115: 'quality',
    // Home Systems & Energy
    48: 'systems', 50: 'systems', 60: 'systems', 61: 'systems', 86: 'systems',
    // Connectivity & Commute
    42: 'connectivity', 43: 'connectivity', 45: 'connectivity', 57: 'connectivity',
    64: 'connectivity', 76: 'connectivity', 85: 'connectivity',
    // Lifestyle & Community
    44: 'lifestyle', 72: 'lifestyle', 73: 'lifestyle', 74: 'lifestyle',
    80: 'lifestyle', 81: 'lifestyle', 82: 'lifestyle', 83: 'lifestyle',
    84: 'lifestyle', 88: 'lifestyle', 98: 'lifestyle', 101: 'lifestyle',
    102: 'lifestyle', 105: 'lifestyle', 120: 'lifestyle', 122: 'lifestyle',
    // Climate & Environment
    46: 'climate', 47: 'climate', 49: 'climate', 52: 'climate', 77: 'climate',
    79: 'climate', 106: 'climate', 121: 'climate',
    // Investment & Market
    1: 'investment',  2: 'investment',  4: 'investment',  5: 'investment',
    7: 'investment',  8: 'investment',  9: 'investment',  65: 'investment',
    70: 'investment', 71: 'investment', 75: 'investment', 89: 'investment',
    90: 'investment', 91: 'investment', 92: 'investment', 93: 'investment',
    103: 'investment', 111: 'investment',
};

/** Per-factor-ID tag color styles */
const TAG_COLOR_MAP: Record<number, { bg: string; text: string; border: string }> = {
    // Street View Intelligence
    94: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    95: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    96: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    97: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
    98: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    // Investment Intelligence
    89: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    90: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    91: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    92: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    93: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    // Community & Condition
    102: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    103: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    104: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    105: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    // Other
    100: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
    101: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    83: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    111: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    // Interior Room Intelligence
    113: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    114: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    115: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    116: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
};
const DEFAULT_TAG_STYLE = { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' };






const getCategoryForFactor = (id: number): string => FACTOR_TO_BUCKET[id] || 'quality';

const FactorRow: React.FC<{ factor: ExtractedFactor }> = ({ factor }) => {
    const tagStyle = TAG_COLOR_MAP[factor.id] || DEFAULT_TAG_STYLE;
    return (
        <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors align-top">
            <td className="py-3 px-3 text-sm text-slate-700 font-medium w-[20%]">
                <div className="flex items-center">
                    <span className="text-[9px] font-black text-slate-300 mr-1.5">#{factor.id}</span>
                    <span className="font-bold">{factor.name}</span>
                </div>
            </td>
            <td className="py-3 px-3 text-[11px] text-slate-500 font-normal leading-relaxed italic w-[45%] pr-4 border-x border-slate-50">
                {factor.value && factor.value !== 'Data not available'
                    ? (typeof factor.value === 'object' ? JSON.stringify(factor.value) : factor.value)
                    : '-'}
            </td>
            <td className="py-3 px-3 w-[35%]">
                <div className="flex flex-wrap gap-1 mt-0.5">
                    {factor.tags.map((tag, i) => (
                        <span key={i} className={`text-[10px] font-bold ${tagStyle.text} ${tagStyle.bg} px-2 py-0.5 rounded-md border ${tagStyle.border}`}>
                            {tag}
                        </span>
                    ))}
                </div>
            </td>
        </tr>
    );
};

const CategorySection: React.FC<{
    categoryKey: string;
    factors: ExtractedFactor[];
    signals: TaxonomySignal[];
}> = ({ categoryKey, factors, signals }) => {
    const cat = CATEGORY_MAP[categoryKey];
    if (!cat) return null;

    const zone = BUCKET_TO_TAXONOMY_ZONE[categoryKey];
    const totalTagsInZone = zone ? tagsByZone(zone).length : 0;

    return (
        <>
            <tr className={`bg-${cat.color}-50/50`}>
                <td colSpan={3} className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                        <i className={`fa-solid ${cat.icon} text-${cat.color}-500 text-xs`}></i>
                        <span className="text-xs font-black text-slate-700">{cat.label}</span>
                        <span className={`text-[9px] font-bold ${factors.length === 0 ? 'text-slate-300' : 'text-slate-400'}`}>
                            {factors.length === 0 ? '0 factors' : factors.length}
                        </span>
                        {zone && signals.length > 0 && (
                            <span className={`text-[9px] font-bold text-${cat.color}-700 bg-${cat.color}-100 px-1.5 py-0.5 rounded ml-1`}>
                                {signals.length}/{totalTagsInZone} taxonomy match
                            </span>
                        )}
                    </div>
                </td>
            </tr>
            {zone && signals.length > 0 && (
                <tr className="border-b border-slate-100">
                    <td colSpan={3} className={`py-2.5 px-3 bg-${cat.color}-50/20`}>
                        <div className="flex items-start gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 pt-1 flex-shrink-0">
                                Detected
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {signals.map(sig => (
                                    <span
                                        key={sig.tagId}
                                        title={`Evidence: ${sig.evidence.join(' · ')}\nFrom factor(s): ${sig.sourceFactorIds.join(', ')}`}
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border cursor-help ${
                                            sig.confidence === 'high'
                                                ? `bg-${cat.color}-50 text-${cat.color}-700 border-${cat.color}-200`
                                                : 'bg-slate-50 text-slate-500 border-slate-200'
                                        }`}
                                    >
                                        {sig.confidence === 'high' && <i className="fa-solid fa-check text-[8px] mr-1" />}
                                        {sig.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
            {factors.length === 0 ? (
                <tr>
                    <td colSpan={3} className="py-3 px-3 text-[11px] italic text-slate-300">
                        No factors extracted in this bucket yet.
                    </td>
                </tr>
            ) : (
                factors.map(f => <FactorRow key={f.id} factor={f} />)
            )}
        </>
    );
};

/**
 * Renders one heuristic scoring result as an expandable card with a score gauge,
 * per-component breakdown bars, and evidence + gaps.
 */
const ScoringCard: React.FC<{ result: ScoringResult }> = ({ result }) => {
    const [expanded, setExpanded] = useState(false);
    const { score, grade, color, label, description, icon, components, summary, confidence } = result;

    const gradeColor =
        grade === 'A' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
        : grade === 'B' ? 'text-cyan-600 bg-cyan-50 border-cyan-200'
        : grade === 'C' ? 'text-amber-600 bg-amber-50 border-amber-200'
        : grade === 'D' ? 'text-orange-600 bg-orange-50 border-orange-200'
        : 'text-rose-600 bg-rose-50 border-rose-200';

    const confidenceColor =
        confidence === 'high' ? 'text-emerald-600'
        : confidence === 'medium' ? 'text-amber-600'
        : 'text-slate-400';

    return (
        <div className={`bg-white border border-slate-200 rounded-2xl overflow-hidden`}>
            {/* Header */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
            >
                <div className={`w-12 h-12 rounded-xl bg-${color}-50 text-${color}-600 flex items-center justify-center flex-shrink-0`}>
                    <i className={`fa-solid ${icon} text-lg`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-black text-slate-800">{label}</h4>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${confidenceColor}`}>
                            {confidence} confidence
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug truncate">{description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`px-2.5 py-1 rounded-lg border text-sm font-black ${gradeColor}`}>
                        {grade}
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-black text-slate-800 leading-none">{score}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">/100</div>
                    </div>
                    <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-300 text-xs ml-2`} />
                </div>
            </button>

            {/* Summary line — always visible */}
            <div className="px-5 pb-3 -mt-1">
                <p className="text-xs text-slate-600 leading-relaxed">{summary}</p>
            </div>

            {/* Expanded breakdown */}
            {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 space-y-3">
                    {components.map((c, i) => {
                        const pct = Math.round((c.earned / c.max) * 100);
                        const barColor =
                            pct >= 75 ? 'bg-emerald-500'
                            : pct >= 50 ? 'bg-cyan-500'
                            : pct >= 25 ? 'bg-amber-500'
                            : 'bg-slate-300';
                        return (
                            <div key={i} className="bg-white border border-slate-100 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[12px] font-black text-slate-700">{c.label}</span>
                                    <span className="text-[11px] font-bold text-slate-500">
                                        {c.earned} / {c.max}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 italic mb-2 leading-snug">{c.rationale}</p>
                                <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                                    <div
                                        className={`${barColor} h-1.5 rounded-full transition-all`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                {c.evidence.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {c.evidence.map((e, j) => (
                                            <span key={j} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                                <i className="fa-solid fa-check text-[8px] mr-1" />{e}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {c.missing && c.missing.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {c.missing.map((m, j) => (
                                            <span key={j} className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                                                <i className="fa-solid fa-minus text-[8px] mr-1" />{m}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ScoringPanel: React.FC<{ results: ScoringResult[] }> = ({ results }) => {
    if (results.length === 0) return null;
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
                <i className="fa-solid fa-gauge-high text-indigo-500 text-sm" />
                <h3 className="text-sm font-black text-slate-700">Buyer Heuristic Scores</h3>
                <span className="text-[10px] font-bold text-slate-400">
                    Derived from factors + taxonomy
                </span>
            </div>
            <div className="space-y-2">
                {results.map(r => <ScoringCard key={r.modelId} result={r} />)}
            </div>
        </div>
    );
};

export const ContextGraphView: React.FC<Props> = ({ data, loading, onExtract }) => {
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [showJson, setShowJson] = useState(false);
    const [activeTab, setActiveTab] = useState<'factors' | 'buyerDna'>('factors');

    // Resolve taxonomy signals from factor tags (computed at read time; no AI cost).
    const taxonomySignals = useMemo(() => {
        if (!data?.factors) return {};
        const resolved = (data.factors as any[]).map(resolveFactor).filter(Boolean) as ExtractedFactor[];
        return resolveTaxonomySignalsFromFactors(resolved);
    }, [data?.factors]);

    // Heuristic scoring models — pure functions over factors + taxonomy signals.
    const scoringResults: ScoringResult[] = useMemo(() => {
        if (!data?.factors) return [];
        const resolved = (data.factors as any[]).map(resolveFactor).filter(Boolean) as ExtractedFactor[];
        return SCORING_MODELS.map(model => model(resolved, taxonomySignals));
    }, [data?.factors, taxonomySignals]);

    if (!data && !loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                    <i className="fa-solid fa-diagram-project text-3xl text-indigo-500"></i>
                </div>
                <div className="text-center">
                    <h3 className="text-xl font-black text-slate-800 mb-2">Factors Extraction</h3>
                    <p className="text-sm text-slate-500 max-w-md">
                        Extract key decision factors and semantic analysis from this property's analyzed data for a high-density overview.
                    </p>
                </div>
                <button
                    onClick={onExtract}
                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-black text-sm shadow-lg hover:scale-105 transition-all flex items-center gap-3"
                >
                    <i className="fa-solid fa-bolt-lightning"></i>
                    Extract Context Factors
                </button>
            </div>
        );
    }

    if (!data) return null;

    // Normalize factors: expand compact {i,t,v} and old {id,name,tags} formats
    const rawFactors = Array.isArray(data.factors) ? data.factors : [];
    const normalizedFactors = rawFactors.map(resolveFactor).filter((f): f is ExtractedFactor => f !== null);
    const grouped: Record<string, ExtractedFactor[]> = {};
    for (const factor of normalizedFactors) {
        if (DELETED_FACTOR_IDS.has(factor.id)) continue;
        const cat = getCategoryForFactor(factor.id);
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(factor);
    }

    const filteredCategories = activeFilter === 'all'
        ? Object.keys(CATEGORY_MAP)
        : [activeFilter];

    const totalFactors = normalizedFactors.length;
    const allTags = normalizedFactors.flatMap(f => Array.isArray(f.tags) ? f.tags : []);
    const uniqueTags = new Set(allTags);

    // Estimate token count (~4 chars per token for Gemini)
    const jsonSize = JSON.stringify(data).length;
    const estimatedTokens = Math.round(jsonSize / 4);
    const tokenLabel = estimatedTokens >= 1000 ? `${(estimatedTokens / 1000).toFixed(1)}K` : String(estimatedTokens);

    // Extract neighborhood name from factor 83 (Micro-Neighborhood Identity)
    const neighborhoodFactor = normalizedFactors.find(f => f.id === 83);
    const neighborhoodName = neighborhoodFactor?.value && typeof neighborhoodFactor.value === 'string' && neighborhoodFactor.value !== 'Data not available'
        ? neighborhoodFactor.value.split(' — ')[0].split(',')[0].trim()
        : null;

    // Helper to format lastUpdated from either Firestore Timestamp or Date
    const formatUpdateDate = (dateInfo: any) => {
        if (!dateInfo) return 'Unknown';
        // Firestore Timestamp
        if (dateInfo.seconds) return new Date(dateInfo.seconds * 1000).toLocaleDateString();
        // Date object or string
        return new Date(dateInfo).toLocaleDateString();
    };

    return (
        <div className="space-y-6">
            {/* Minimal header */}
            <div className="text-xs text-slate-400 px-1">
                <span>
                    {neighborhoodName && (
                        <><span className="text-slate-600 font-semibold">{neighborhoodName}</span> · </>
                    )}
                    Extracted {formatUpdateDate(data.lastUpdated)} · {totalFactors} factors · ~{tokenLabel} tokens
                </span>
            </div>

            {/* Summary Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                    <h4 className="text-sm font-black text-emerald-800 mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-thumbs-up"></i> Top Strengths
                    </h4>
                    <ul className="space-y-2">
                        {Array.isArray(data.summary?.topStrengths) && data.summary.topStrengths.map((s, i) => (
                            <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                                <i className="fa-solid fa-check text-[10px] mt-1.5"></i>
                                {typeof s === 'string' ? s : JSON.stringify(s)}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                    <h4 className="text-sm font-black text-amber-800 mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation"></i> Top Concerns
                    </h4>
                    <ul className="space-y-2">
                        {Array.isArray(data.summary?.topConcerns) && data.summary.topConcerns.map((c, i) => (
                            <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                                <i className="fa-solid fa-circle-exclamation text-[10px] mt-1.5"></i>
                                {typeof c === 'string' ? c : JSON.stringify(c)}
                            </li>
                        ))}
                    </ul>
                </div>
                {data.summary?.propertyHighlight && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                        <h4 className="text-sm font-black text-indigo-800 mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-star"></i> Property Highlight
                        </h4>
                        <p className="text-sm text-indigo-700 leading-relaxed">
                            {typeof data.summary.propertyHighlight === 'object'
                                ? JSON.stringify(data.summary.propertyHighlight)
                                : data.summary.propertyHighlight}
                        </p>
                    </div>
                )}
            </div>

            {/* Key Metrics */}
            {data.keyMetrics && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                    <h4 className="text-sm font-black text-slate-700 flex items-center gap-2 mb-4">
                        <i className="fa-solid fa-layer-group text-indigo-500"></i>
                        Key Metrics
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(data.keyMetrics).filter(([, v]) => v != null).map(([key, val]) => (
                            <div key={key} className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-center">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                                <div className="text-sm font-black text-slate-700">{typeof val === 'number' && val > 999 ? val.toLocaleString() : String(val)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Buyer Heuristic Scores */}
            <ScoringPanel results={scoringResults} />

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                    onClick={() => setActiveTab('factors')}
                    className={`px-4 py-2 text-sm font-black transition-all border-b-2 ${activeTab === 'factors' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <i className="fa-solid fa-list mr-2"></i> Granular Factors
                </button>
                <button
                    onClick={() => setActiveTab('buyerDna')}
                    className={`px-4 py-2 text-sm font-black transition-all border-b-2 ${activeTab === 'buyerDna' ? 'border-fuchsia-500 text-fuchsia-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <i className="fa-solid fa-dna mr-2"></i> Buyer DNA
                </button>
            </div>

            {activeTab === 'factors' && (
                <>
                    {/* Category Filter — split into Home Features vs Property Context */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveFilter('all')}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${activeFilter === 'all'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            All Factors
                        </button>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 px-1">Home</span>
                        {Object.entries(CATEGORY_MAP).filter(([, cat]) => cat.group === 'home').map(([key, cat]) => (
                            <button
                                key={key}
                                onClick={() => setActiveFilter(key)}
                                className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap flex items-center gap-2 ${activeFilter === key
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <i className={`fa-solid ${cat.icon} text-[10px]`}></i>
                                {cat.label}
                            </button>
                        ))}
                        <span className="h-6 w-px bg-slate-200 mx-1 flex-shrink-0" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 px-1">Context</span>
                        {Object.entries(CATEGORY_MAP).filter(([, cat]) => cat.group === 'context').map(([key, cat]) => (
                            <button
                                key={key}
                                onClick={() => setActiveFilter(key)}
                                className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap flex items-center gap-2 ${activeFilter === key
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                <i className={`fa-solid ${cat.icon} text-[10px]`}></i>
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Factors Table */}
                    <table className="w-full border-collapse bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <thead>
                            <tr className="bg-slate-100 border-b border-slate-200">
                                <th className="py-2.5 px-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[20%]">Factor</th>
                                <th className="py-2.5 px-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[45%]">Insight</th>
                                <th className="py-2.5 px-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest w-[35%]">Semantic Tags</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCategories.map(catKey => {
                                const zone = BUCKET_TO_TAXONOMY_ZONE[catKey];
                                const zoneSignals = zone
                                    ? (Object.values(taxonomySignals) as TaxonomySignal[]).filter(s => s.zone === zone)
                                    : [];
                                return (
                                    <CategorySection
                                        key={catKey}
                                        categoryKey={catKey}
                                        factors={grouped[catKey] || []}
                                        signals={zoneSignals}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                </>
            )}

            {activeTab === 'buyerDna' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {data.buyerDna && typeof data.buyerDna === 'object' && !Array.isArray(data.buyerDna) ? (
                        Object.entries(data.buyerDna).map(([key, info]: [string, any]) => {
                            const score = info.score || 0;
                            // Color logic based on score
                            let color = 'bg-slate-100 text-slate-600 border-slate-200';
                            let barColor = 'bg-slate-300';
                            if (score >= 90) { color = 'bg-emerald-50 text-emerald-700 border-emerald-200'; barColor = 'bg-emerald-500'; }
                            else if (score >= 70) { color = 'bg-cyan-50 text-cyan-700 border-cyan-200'; barColor = 'bg-cyan-500'; }
                            else if (score >= 50) { color = 'bg-indigo-50 text-indigo-700 border-indigo-200'; barColor = 'bg-indigo-400'; }
                            else if (score >= 30) { color = 'bg-amber-50 text-amber-700 border-amber-200'; barColor = 'bg-amber-400'; }
                            else { color = 'bg-rose-50 text-rose-700 border-rose-200'; barColor = 'bg-rose-500'; }

                            // Format key (e.g. "turnkeyVsProject" -> "Turnkey Vs Project")
                            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                            return (
                                <div key={key} className={`border rounded-xl p-4 flex flex-col justify-between ${color}`}>
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-[11px] font-black uppercase tracking-wider">{displayKey}</h4>
                                            <span className="text-sm font-black">{score}</span>
                                        </div>
                                        <div className="w-full bg-black/5 rounded-full h-1.5 mb-3">
                                            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${score}%` }}></div>
                                        </div>
                                        <p className="text-xs leading-relaxed opacity-90">{info.summary}</p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full py-10 flex flex-col items-center justify-center text-slate-400">
                            <i className="fa-solid fa-dna text-3xl mb-3 text-slate-300"></i>
                            <p>No Buyer DNA compressed data found. Run the extraction pipeline or use the Bootstrap button in City Data.</p>
                        </div>
                    )}
                </div>
            )}

            {/* JSON Preview */}
            {showJson && (
                <div className="bg-slate-900 rounded-xl p-6 overflow-auto max-h-[600px]">
                    <pre className="text-xs text-slate-300 font-mono">
                        {JSON.stringify(data, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};
