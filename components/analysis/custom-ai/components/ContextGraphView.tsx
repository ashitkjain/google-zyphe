import React, { useState } from 'react';
import { ExtractedFactor } from '../../../../utils/contextGraphPrecompute';
import { ContextGraphExtractionResult } from '../../../../types';

interface Props {
    data: ContextGraphExtractionResult;
    loading: boolean;
    onExtract: () => void;
}

const CATEGORY_MAP: Record<string, { label: string; icon: string; color: string; ranges: [number, number][] }> = {
    property: { label: 'Property & Financials', icon: 'fa-house', color: 'emerald', ranges: [[1, 30]] },
    location: { label: 'Location & Lifestyle', icon: 'fa-map-pin', color: 'rose', ranges: [[31, 50], [76, 88]] },
    intelligence: { label: 'AI Intelligence', icon: 'fa-brain', color: 'violet', ranges: [[51, 75], [100, 105]] },
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

const FactorCard: React.FC<{ factor: ExtractedFactor }> = ({ factor }) => (
    <div className="group bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-indigo-200 transition-all">
        <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">#{factor.id}</span>
                <h4 className="text-sm font-bold text-slate-800">{factor.name}</h4>
            </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed mb-1">{factor.value}</p>
        {factor.tags.length > 0 && (() => {
            const tagStyle = TAG_COLOR_MAP[factor.id] || DEFAULT_TAG_STYLE;
            return (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {factor.tags.map((tag, i) => (
                        <span key={i} className={`text-[10px] font-bold ${tagStyle.text} ${tagStyle.bg} px-2.5 py-1 rounded-lg border ${tagStyle.border}`}>
                            {tag}
                        </span>
                    ))}
                </div>
            );
        })()}
    </div>
);

const CategorySection: React.FC<{ categoryKey: string; factors: ExtractedFactor[] }> = ({ categoryKey, factors }) => {
    const cat = CATEGORY_MAP[categoryKey];
    if (!cat || factors.length === 0) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-lg bg-${cat.color}-100 flex items-center justify-center`}>
                    <i className={`fa-solid ${cat.icon} text-${cat.color}-600 text-sm`}></i>
                </div>
                <h3 className="text-lg font-black text-slate-800">{cat.label}</h3>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                    {factors.length} factors
                </span>
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

    // Group factors by category (filter out retired factor IDs from old cached graphs)
    const SUPPRESSED_IDS = new Set([10, 16, 53, 55, 56, 107, 110, 112]); // 10=Urgency→5, 16→58, 53→49, 55→48, 56→86, 107→47, 110=ListingFlags, 112→79
    const grouped: Record<string, ExtractedFactor[]> = {};
    for (const factor of data.factors) {
        if (SUPPRESSED_IDS.has(factor.id)) continue;
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

    // Extract neighborhood name from factor 83 (Micro-Neighborhood Identity)
    const neighborhoodFactor = data.factors.find(f => f.id === 83);
    const neighborhoodName = neighborhoodFactor?.value && neighborhoodFactor.value !== 'Data not available'
        ? neighborhoodFactor.value.split(' — ')[0].split(',')[0].trim()
        : null;

    return (
        <div className="space-y-6">
            {/* Minimal header */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                    {neighborhoodName && (
                        <><span className="text-slate-600 font-semibold">{neighborhoodName}</span> · </>
                    )}
                    Extracted {new Date(data.extractedAt).toLocaleDateString()} · {totalFactors} factors
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
                {data.summary.propertyHighlight && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                        <h4 className="text-sm font-black text-indigo-800 mb-3 flex items-center gap-2">
                            <i className="fa-solid fa-star"></i> Property Highlight
                        </h4>
                        <p className="text-sm text-indigo-700 leading-relaxed">{data.summary.propertyHighlight}</p>
                    </div>
                )}
            </div>

            {/* Enrichment Panel */}
            {(data.keyMetrics || data.enrichment) && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5">
                    <h4 className="text-sm font-black text-slate-700 flex items-center gap-2">
                        <i className="fa-solid fa-layer-group text-indigo-500"></i>
                        Enrichment Layer
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg ml-1">for downstream search & recommendations</span>
                    </h4>

                    {/* Key Metrics Row */}
                    {data.keyMetrics && (
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(data.keyMetrics).filter(([, v]) => v != null).map(([key, val]) => (
                                <div key={key} className="bg-white border border-slate-100 rounded-lg px-3 py-2 text-center">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                                    <div className="text-sm font-black text-slate-700">{typeof val === 'number' && val > 999 ? val.toLocaleString() : val}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Qualitative Narratives */}
                    {data.enrichment && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {data.enrichment.conditionNotes && (
                                <div className="bg-white border border-slate-100 rounded-xl p-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <i className="fa-solid fa-wrench text-[8px]"></i> Condition Notes
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">{data.enrichment.conditionNotes}</p>
                                </div>
                            )}
                            {data.enrichment.marketNarrative && (
                                <div className="bg-white border border-slate-100 rounded-xl p-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <i className="fa-solid fa-chart-line text-[8px]"></i> Market Context
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">{data.enrichment.marketNarrative}</p>
                                </div>
                            )}
                            {data.enrichment.neighborhoodCharacter && (
                                <div className="bg-white border border-slate-100 rounded-xl p-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <i className="fa-solid fa-map text-[8px]"></i> Neighborhood Identity
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">{data.enrichment.neighborhoodCharacter}</p>
                                </div>
                            )}

                            {data.enrichment.topNearbyPlaces?.length ? (
                                <div className="bg-white border border-slate-100 rounded-xl p-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <i className="fa-solid fa-location-dot text-[8px]"></i> Top Nearby Places
                                    </div>
                                    <div className="space-y-1">
                                        {data.enrichment.topNearbyPlaces.map((place, i) => (
                                            <div key={i} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                                <i className="fa-solid fa-circle text-[4px] text-slate-300"></i>
                                                {place}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            {data.enrichment.climateProfile && (
                                <div className="bg-white border border-slate-100 rounded-xl p-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <i className="fa-solid fa-shield-halved text-[8px]"></i> Climate Profile
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {data.enrichment.climateProfile.fire != null && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${data.enrichment.climateProfile.fire >= 7 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                                                🔥 Fire: {data.enrichment.climateProfile.fire}/10
                                            </span>
                                        )}
                                        {data.enrichment.climateProfile.flood != null && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${data.enrichment.climateProfile.flood >= 7 ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                                                🌊 Flood: {data.enrichment.climateProfile.flood}/10
                                            </span>
                                        )}
                                        {data.enrichment.climateProfile.wind != null && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200`}>
                                                💨 Wind: {data.enrichment.climateProfile.wind}/10
                                            </span>
                                        )}
                                        {data.enrichment.climateProfile.heat != null && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${data.enrichment.climateProfile.heat >= 7 ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                                                🌡 Heat: {data.enrichment.climateProfile.heat}/10
                                            </span>
                                        )}
                                        {data.enrichment.climateProfile.drought && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                                                🏜 Drought: {data.enrichment.climateProfile.drought}
                                            </span>
                                        )}
                                        {data.enrichment.climateProfile.disasters && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
                                                ⚠ Disasters: {data.enrichment.climateProfile.disasters}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
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
