import React, { useState } from 'react';
import { ContextGraphExtractionResult } from '../../../../types';
import {
    FACTOR_NAMES,
    expandFactor,
    resolveFactor,
    DELETED_FACTOR_IDS,
    ExtractedFactor
} from '../../../../constants/contextGraphFactors';

interface Props {
    data: ContextGraphExtractionResult;
    loading: boolean;
    onExtract: () => void;
}

const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string; ranges: [number, number][] }> = {
    property: { label: 'Property & Financials', icon: 'fa-house', color: 'emerald', ranges: [[1, 30]] },
    location: { label: 'Location & Lifestyle', icon: 'fa-map-pin', color: 'rose', ranges: [[31, 50], [76, 88], [120, 122]] },
    intelligence: { label: 'AI Factors', icon: 'fa-brain', color: 'violet', ranges: [[51, 75], [100, 105]] },
    visual: { label: 'Visual & Street View', icon: 'fa-street-view', color: 'cyan', ranges: [[94, 98], [108, 116]] },
    investment: { label: 'Investment & Risk', icon: 'fa-chart-line', color: 'amber', ranges: [[89, 93], [111, 111]] },
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






const getCategoryForFactor = (id: number): string => {
    // Explicit overrides for factors that belong in a different tab than their ID range
    if (id === 34) return 'intelligence'; // Curb Appeal → AI Intelligence
    if (id === 100) return 'property';    // Agent Highlights → Property & Financials
    for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
        if (cat.ranges.some(([lo, hi]) => id >= lo && id <= hi)) return key;
    }
    return 'property';
};

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
                {factor.value && factor.value !== 'Data not available' ? factor.value : '-'}
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

const CategorySection: React.FC<{ categoryKey: string; factors: ExtractedFactor[] }> = ({ categoryKey, factors }) => {
    const cat = CATEGORY_MAP[categoryKey];
    if (!cat || factors.length === 0) return null;

    return (
        <>
            <tr className={`bg-${cat.color}-50/50`}>
                <td colSpan={3} className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                        <i className={`fa-solid ${cat.icon} text-${cat.color}-500 text-xs`}></i>
                        <span className="text-xs font-black text-slate-700">{cat.label}</span>
                        <span className="text-[9px] font-bold text-slate-400">{factors.length}</span>
                    </div>
                </td>
            </tr>
            {factors.map(f => <FactorRow key={f.id} factor={f} />)}
        </>
    );
};

export const ContextGraphView: React.FC<Props> = ({ data, loading, onExtract }) => {
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [showJson, setShowJson] = useState(false);

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
    const normalizedFactors = (data.factors || []).map(resolveFactor).filter((f): f is ExtractedFactor => f !== null);
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
    const allTags = normalizedFactors.flatMap(f => f.tags || []);
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
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                    {neighborhoodName && (
                        <><span className="text-slate-600 font-semibold">{neighborhoodName}</span> · </>
                    )}
                    Extracted {formatUpdateDate(data.lastUpdated)} · {totalFactors} factors · ~{tokenLabel} tokens
                </span>
                <button onClick={onExtract} title="Re-extract context graph" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                    <i className="fa-solid fa-rotate text-slate-400 hover:text-indigo-500 text-[11px]"></i>
                </button>
            </div>

            {/* Summary Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                    <h4 className="text-sm font-black text-emerald-800 mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-thumbs-up"></i> Top Strengths
                    </h4>
                    <ul className="space-y-2">
                        {Array.isArray(data.summary.topStrengths) && data.summary.topStrengths.map((s, i) => (
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
                        {Array.isArray(data.summary.topConcerns) && data.summary.topConcerns.map((c, i) => (
                            <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                                <i className="fa-solid fa-circle-exclamation text-[10px] mt-1.5"></i>
                                {typeof c === 'string' ? c : JSON.stringify(c)}
                            </li>
                        ))}
                    </ul>
                </div>
                {data.summary.propertyHighlight && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                        <h4 className="text-sm font-black text-indigo-800 mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-star"></i> Property Highlight
                        </h4>
                        <p className="text-sm text-indigo-700 leading-relaxed">{data.summary.propertyHighlight}</p>
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

            {/* Category Filter */}
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
                {Object.entries(CATEGORY_MAP).map(([key, cat]) => (
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
                    {filteredCategories.map(catKey => (
                        <CategorySection
                            key={catKey}
                            categoryKey={catKey}
                            factors={grouped[catKey] || []}
                        />
                    ))}
                </tbody>
            </table>

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
