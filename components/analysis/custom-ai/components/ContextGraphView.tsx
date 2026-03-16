import React, { useState } from 'react';
import { ExtractedFactor } from '../../../../utils/contextGraphPrecompute';
import { ContextGraphExtractionResult } from '../../../../types';

interface Props {
    data: ContextGraphExtractionResult;
    loading: boolean;
    onExtract: () => void;
}

const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string; range: [number, number] }> = {
    financial: { label: 'Financial & Market', icon: 'fa-dollar-sign', color: 'emerald', range: [1, 10] },
    structural: { label: 'Structural & Size', icon: 'fa-ruler-combined', color: 'blue', range: [11, 20] },
    interior: { label: 'Interior Design', icon: 'fa-couch', color: 'violet', range: [21, 30] },
    outdoor: { label: 'Outdoor & Lot', icon: 'fa-tree', color: 'amber', range: [31, 40] },
    location: { label: 'Location & Community', icon: 'fa-map-pin', color: 'rose', range: [41, 45] },
    environment: { label: 'Environmental', icon: 'fa-leaf', color: 'teal', range: [46, 50] },
    advanced: { label: 'Advanced Intelligence', icon: 'fa-brain', color: 'fuchsia', range: [51, 70] },
};

const CONFIDENCE_STYLES: Record<string, string> = {
    high: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-500 border-slate-200',
};

const getCategoryForFactor = (id: number): string => {
    for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
        if (id >= cat.range[0] && id <= cat.range[1]) return key;
    }
    return 'financial';
};

const FactorCard: React.FC<{ factor: ExtractedFactor }> = ({ factor }) => (
    <div className="group bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-indigo-200 transition-all">
        <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">#{factor.id}</span>
                <h4 className="text-sm font-bold text-slate-800">{factor.name}</h4>
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${CONFIDENCE_STYLES[factor.confidence] || CONFIDENCE_STYLES.low}`}>
                {factor.confidence}
            </span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-3">{factor.value}</p>
        {factor.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
                {factor.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                        {tag}
                    </span>
                ))}
            </div>
        )}
    </div>
);

const CategorySection: React.FC<{ categoryKey: string; factors: ExtractedFactor[] }> = ({ categoryKey, factors }) => {
    const cat = CATEGORY_MAP[categoryKey];
    if (!cat || factors.length === 0) return null;

    const highCount = factors.filter(f => f.confidence === 'high').length;
    const coverage = Math.round((highCount / factors.length) * 100);

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-${cat.color}-100 flex items-center justify-center`}>
                        <i className={`fa-solid ${cat.icon} text-${cat.color}-600 text-sm`}></i>
                    </div>
                    <h3 className="text-lg font-black text-slate-800">{cat.label}</h3>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                        {factors.length} factors
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${coverage}%` }}
                        />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{coverage}% high confidence</span>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {factors.map(f => <FactorCard key={f.id} factor={f} />)}
            </div>
        </div>
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
                    <h3 className="text-xl font-black text-slate-800 mb-2">Context Graph Extraction</h3>
                    <p className="text-sm text-slate-500 max-w-md">
                        Extract decision factors from this property's analyzed data to power the buyer context graph.
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

    // Group factors by category
    const grouped: Record<string, ExtractedFactor[]> = {};
    for (const factor of data.factors) {
        const cat = getCategoryForFactor(factor.id);
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(factor);
    }

    const filteredCategories = activeFilter === 'all'
        ? Object.keys(CATEGORY_MAP)
        : [activeFilter];

    const totalFactors = data.factors.length;
    const highConfidence = data.factors.filter(f => f.confidence === 'high').length;
    const allTags = data.factors.flatMap(f => f.tags);
    const uniqueTags = new Set(allTags);

    return (
        <div className="space-y-6">
            {/* Summary Header */}
            <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 border border-indigo-100 rounded-2xl p-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 mb-1">
                            <i className="fa-solid fa-diagram-project text-indigo-500 mr-2"></i>
                            Context Graph — {data.address}
                        </h3>
                        <p className="text-xs text-slate-500">
                            Extracted {new Date(data.extractedAt).toLocaleString()} · {totalFactors} factors · {uniqueTags.size} unique tags
                        </p>
                    </div>
                    <div className="flex items-center gap-2 pr-52">
                        <button
                            onClick={onExtract}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <i className="fa-solid fa-rotate"></i> Re-Extract
                        </button>
                        <button
                            onClick={() => setShowJson(!showJson)}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <i className="fa-solid fa-code"></i> {showJson ? 'Hide' : 'Show'} JSON
                        </button>
                        <button
                            onClick={() => {
                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = `context_graph_${data.address?.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
                                a.click();
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[11px] font-black hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                            <i className="fa-solid fa-download"></i> Download
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl p-4 border border-slate-100">
                        <div className="text-2xl font-black text-indigo-600">{totalFactors}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Factors</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-100">
                        <div className="text-2xl font-black text-emerald-600">{highConfidence}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">High Confidence</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-100">
                        <div className="text-2xl font-black text-violet-600">{uniqueTags.size}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Unique Tags</div>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-100">
                        <div className="text-2xl font-black text-amber-600">{Math.round((highConfidence / totalFactors) * 100)}%</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data Coverage</div>
                    </div>
                </div>
            </div>

            {/* Summary Insights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                    <h4 className="text-sm font-black text-emerald-800 mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-thumbs-up"></i> Top Strengths
                    </h4>
                    <ul className="space-y-2">
                        {data.summary.topStrengths.map((s, i) => (
                            <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                                <i className="fa-solid fa-check text-[10px] mt-1.5"></i>
                                {s}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                    <h4 className="text-sm font-black text-amber-800 mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-triangle-exclamation"></i> Top Concerns
                    </h4>
                    <ul className="space-y-2">
                        {data.summary.topConcerns.map((c, i) => (
                            <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                                <i className="fa-solid fa-circle-exclamation text-[10px] mt-1.5"></i>
                                {c}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                    <h4 className="text-sm font-black text-indigo-800 mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-user-tag"></i> Ideal Buyer
                    </h4>
                    <p className="text-sm text-indigo-700 leading-relaxed">{data.summary.buyerProfile}</p>
                </div>
            </div>

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

            {/* Factor Cards by Category */}
            {filteredCategories.map(catKey => (
                <CategorySection
                    key={catKey}
                    categoryKey={catKey}
                    factors={grouped[catKey] || []}
                />
            ))}

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
