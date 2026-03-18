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

/** Static factor ID → name lookup (names stripped from stored data to save tokens) */
const FACTOR_NAMES: Record<number, string> = {
    1: 'Price Bracket', 2: 'HOA Friction', 3: 'Tax Burden', 4: 'True Carrying Cost',
    5: 'Seller Motivation', 6: 'ADU / House-Hacking', 7: 'STR Viability', 8: 'LTR Yield',
    9: 'Historical Appreciation', 14: 'Usable Square Footage',
    17: 'Home Office', 19: 'Foundation & Storage', 20: 'Construction Era',
    21: 'Move-In Readiness', 22: 'Renovation Upside', 23: 'Architectural Style',
    24: 'Natural Light', 25: 'Layout Flow', 26: 'Kitchen Quality',
    27: 'Bathroom Quality', 28: 'Flooring Material', 29: 'Storage Capacity',
    30: 'Smart Home Features', 31: 'Commute Access', 32: 'Noise Level',
    33: 'Privacy Level', 34: 'Curb Appeal', 35: 'Street Character',
    36: 'View Quality', 37: 'Outdoor Living', 38: 'Pool / Spa',
    39: 'Usable Yard', 40: 'Landscaping', 41: 'Exterior Style',
    42: 'Transit Access', 43: 'Walkability', 44: 'Bike Score',
    45: 'Grocery Access', 46: 'Wildfire Risk', 47: 'Flood Risk',
    48: 'Solar Yield', 49: 'Pollen Safety', 50: 'HVAC Quality',
    51: 'Front Orientation / Vastu', 52: 'Air Quality', 54: 'Topography & Elevation',
    57: 'Permit History', 58: 'Laundry', 59: 'Laundry Logistics',
    60: 'Parking', 61: 'Pet Friendliness', 62: 'ADA Accessibility',
    63: 'Insurance Cost', 64: 'Utility Costs', 65: 'Resale Outlook',
    66: 'Rental Demand', 67: 'Comparable Sales', 68: 'Price History',
    69: 'Neighborhood Trend', 70: 'Crime Safety', 71: 'School Proximity',
    72: 'Park Access', 73: 'Dining & Nightlife', 74: 'Shopping Access',
    75: 'Cultural Amenities', 76: 'Internet Connectivity', 77: 'Noise Profile',
    78: 'Drought Risk', 79: 'Disaster History', 80: 'Professional Lifestyle Fit',
    81: 'Family Lifestyle Fit', 82: 'Senior Lifestyle Fit', 83: 'Micro-Neighborhood',
    84: 'Walkable Amenities', 85: 'Medical Proximity', 86: 'EV Infrastructure',
    87: 'Top Nearby Places',
    89: 'Investment Concepts', 90: 'Growth Signals', 91: 'Risk Flags',
    92: 'Market Position', 93: 'Value Drivers',
    94: 'Street Scene', 95: 'Exterior Condition', 96: 'Landscaping Assessment',
    97: 'Parking Assessment', 98: 'Neighborhood Condition',
    100: 'Agent Highlights', 101: 'School Concepts',
    102: 'Community Pulse', 103: 'Resident Sentiment', 104: 'Local Issues', 105: 'Community Vibe',
    106: 'Seismic Risk', 108: 'Sqft Discrepancy', 109: 'Lot Size Verification',
    110: 'Listing Claim Flags', 111: 'Macro Market Signal',
    113: 'Kitchen Intelligence', 114: 'Bathroom Intelligence',
    115: 'Living Spaces', 116: 'Specialty Rooms',
};

/** Expand compact factor {i, t, v?} to full {id, name, tags, value?} — handles both old and new format */
const expandFactor = (f: any): ExtractedFactor => {
    if (f.i != null) {
        // Compact format
        return { id: f.i, name: FACTOR_NAMES[f.i] || `Factor ${f.i}`, tags: f.t || [], value: f.v };
    }
    // Old format — add name from lookup if missing
    return { id: f.id, name: f.name || FACTOR_NAMES[f.id] || `Factor ${f.id}`, tags: f.tags || [], value: f.value };
};



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
        {factor.value && <p className="text-sm text-slate-600 leading-relaxed mb-1">{factor.value}</p>}
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

    // Normalize factors: expand compact {i,t,v} and old {id,name,tags} formats
    const SUPPRESSED_IDS = new Set([10, 11, 12, 13, 15, 16, 18, 53, 55, 56, 107, 110, 112]);
    const normalizedFactors = data.factors.map(expandFactor);
    const grouped: Record<string, ExtractedFactor[]> = {};
    for (const factor of normalizedFactors) {
        if (SUPPRESSED_IDS.has(factor.id)) continue;
        const cat = getCategoryForFactor(factor.id);
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(factor);
    }

    const filteredCategories = activeFilter === 'all'
        ? Object.keys(CATEGORY_MAP)
        : [activeFilter];

    const totalFactors = normalizedFactors.length;
    const allTags = normalizedFactors.flatMap(f => f.tags);
    const uniqueTags = new Set(allTags);

    // Estimate token count (~4 chars per token for Gemini)
    const jsonSize = JSON.stringify(data).length;
    const estimatedTokens = Math.round(jsonSize / 4);
    const tokenLabel = estimatedTokens >= 1000 ? `${(estimatedTokens / 1000).toFixed(1)}K` : String(estimatedTokens);

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
                    Extracted {new Date(data.extractedAt).toLocaleDateString()} · {totalFactors} factors · ~{tokenLabel} tokens
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
                                <div className="text-sm font-black text-slate-700">{typeof val === 'number' && val > 999 ? val.toLocaleString() : val}</div>
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
