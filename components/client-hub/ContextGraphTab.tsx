
import React, { useState, useRef, useEffect } from 'react';
import { exportCityData, estimateExportSize, CityExport, ExportProgress } from '../../services/cityExportService';
import { getContextGraphTaxonomyPrompt } from '../../prompts/property/contextGraphTaxonomy';
import { runDeepResearch, DeepResearchProgress } from '../../services/deepResearchService';

interface Props {
    onNavigate?: (view: string, address: string) => void;
}

const DEFAULT_CITIES = [
    { city: 'Pleasanton', state: 'CA' },
    { city: 'Dublin', state: 'CA' },
];

const ContextGraphTab: React.FC<Props> = ({ onNavigate }) => {
    const [cities, setCities] = useState(DEFAULT_CITIES);
    const [maxProperties, setMaxProperties] = useState(15);
    const [exportData, setExportData] = useState<CityExport | null>(null);
    const [progress, setProgress] = useState<ExportProgress | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [copied, setCopied] = useState<'prompt' | 'data' | 'both' | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Deep Research state
    const [isResearching, setIsResearching] = useState(false);
    const [researchProgress, setResearchProgress] = useState<DeepResearchProgress | null>(null);
    const [researchResult, setResearchResult] = useState<string | null>(null);
    const [researchError, setResearchError] = useState<string | null>(null);
    const resultEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll research output as it streams
    useEffect(() => {
        if (researchProgress?.contentSoFar && resultEndRef.current) {
            resultEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [researchProgress?.contentSoFar]);

    const handleExport = async () => {
        setIsExporting(true);
        setError(null);
        setExportData(null);
        try {
            const result = await exportCityData(cities, setProgress, maxProperties);
            setExportData(result);
        } catch (err: any) {
            setError(err.message || 'Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const citiesLabel = cities.map(c => `${c.city}, ${c.state}`).join(' & ');

    const buildFullPrompt = (): string => {
        const prompt = getContextGraphTaxonomyPrompt(cities[0].city, cities[0].state);
        const dataStr = JSON.stringify(exportData, null, 2);
        return `${prompt}\n\n---\n\n# ATTACHED DATA (${citiesLabel})\n\n\`\`\`json\n${dataStr}\n\`\`\``;
    };

    const handleRunDeepResearch = async () => {
        if (!exportData) return;

        setIsResearching(true);
        setResearchError(null);
        setResearchResult(null);
        setResearchProgress(null);

        const fullPrompt = buildFullPrompt();
        const cityStateKey = cities.map(c => `${c.city}-${c.state}`).join('+');

        try {
            const result = await runDeepResearch(
                fullPrompt,
                (progress) => setResearchProgress(progress),
                { cityStateKey }
            );
            setResearchResult(result);
        } catch (err: any) {
            setResearchError(err.message || 'Deep Research failed');
        } finally {
            setIsResearching(false);
        }
    };

    const copyToClipboard = async (type: 'prompt' | 'data' | 'both' | 'result') => {
        let text = '';
        if (type === 'result') {
            text = researchResult || researchProgress?.contentSoFar || '';
        } else {
            if (type === 'prompt' || type === 'both') {
                text += getContextGraphTaxonomyPrompt(cities[0].city, cities[0].state);
            }
            if (type === 'both') {
                text += '\n\n---\n\n# ATTACHED DATA\n\n```json\n';
            }
            if (type === 'data' || type === 'both') {
                text += JSON.stringify(exportData, null, 2);
            }
            if (type === 'both') {
                text += '\n```';
            }
        }

        try {
            await navigator.clipboard.writeText(text);
            setCopied(type as any);
            setTimeout(() => setCopied(null), 2500);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(type as any);
            setTimeout(() => setCopied(null), 2500);
        }
    };

    const downloadJson = () => {
        if (!exportData) return;
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cities.map(c => c.city.toLowerCase()).join('_')}_export.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadResult = () => {
        const text = researchResult || researchProgress?.contentSoFar || '';
        if (!text) return;
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cities.map(c => c.city.toLowerCase()).join('_')}_taxonomy.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const phaseEmoji: Record<string, string> = {
        init: '🔄',
        city_data: '🏙️',
        zip_listings: '📍',
        properties: '🏠',
        done: '✅',
        error: '❌',
    };

    const researchPhaseConfig: Record<string, { emoji: string; label: string; color: string }> = {
        starting: { emoji: '🚀', label: 'Initializing', color: 'text-slate-600' },
        thinking: { emoji: '🧠', label: 'Thinking', color: 'text-violet-600' },
        writing: { emoji: '✍️', label: 'Writing', color: 'text-indigo-600' },
        complete: { emoji: '✅', label: 'Complete', color: 'text-emerald-600' },
        failed: { emoji: '❌', label: 'Failed', color: 'text-red-600' },
    };

    return (
        <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                    <i className="fa-solid fa-diagram-project text-indigo-500 mr-3" />
                    Context Graph Builder
                </h1>
                <p className="text-slate-500 mt-2 text-sm font-medium max-w-2xl">
                    Export all property and city intelligence data, then send it to Gemini Deep Research
                    to generate a context graph taxonomy for buyer search and recommendations.
                </p>
            </div>

            {/* Step 1: Export Config */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black">1</div>
                    <h2 className="text-lg font-black text-slate-900">Export City Data</h2>
                    <span className="text-xs font-semibold text-slate-400 ml-2">(chatbot-optimized format)</span>
                </div>

                {/* Multi-city inputs */}
                <div className="space-y-3">
                    {cities.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black">{idx + 1}</div>
                            <input
                                value={c.city}
                                onChange={e => {
                                    const updated = [...cities];
                                    updated[idx] = { ...updated[idx], city: e.target.value };
                                    setCities(updated);
                                }}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                                placeholder="City"
                            />
                            <input
                                value={c.state}
                                onChange={e => {
                                    const updated = [...cities];
                                    updated[idx] = { ...updated[idx], state: e.target.value };
                                    setCities(updated);
                                }}
                                className="w-20 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                                placeholder="ST"
                            />
                            {cities.length > 1 && (
                                <button
                                    onClick={() => setCities(cities.filter((_, i) => i !== idx))}
                                    className="w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-xs transition-all"
                                >
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        onClick={() => setCities([...cities, { city: '', state: 'CA' }])}
                        className="text-xs font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1.5 transition-all"
                    >
                        <i className="fa-solid fa-plus" /> Add city
                    </button>
                </div>

                <div className="flex items-end gap-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Properties per City</label>
                        <input
                            type="number"
                            value={maxProperties}
                            onChange={e => setMaxProperties(Number(e.target.value))}
                            min={1}
                            max={50}
                            className="w-32 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
                        />
                    </div>
                </div>

                <button
                    onClick={handleExport}
                    disabled={isExporting || cities.every(c => !c.city)}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-sm font-black rounded-xl transition-all flex items-center gap-2"
                >
                    {isExporting ? (
                        <>
                            <i className="fa-solid fa-spinner fa-spin" />
                            Exporting...
                        </>
                    ) : (
                        <>
                            <i className="fa-solid fa-database" />
                            Export from Firestore
                        </>
                    )}
                </button>

                {/* Progress */}
                {progress && (
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <span>{phaseEmoji[progress.phase] || '⏳'}</span>
                            <span>{progress.message}</span>
                        </div>
                        {progress.total > 0 && (
                            <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm font-semibold">
                        <i className="fa-solid fa-exclamation-triangle mr-2" />
                        {error}
                    </div>
                )}
            </div>

            {/* Step 2: Data Summary & Actions */}
            {exportData && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">2</div>
                        <h2 className="text-lg font-black text-slate-900">Send to Gemini Deep Research</h2>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Properties', value: exportData.meta.totalProperties, icon: 'fa-house', color: 'indigo' },
                            { label: 'Cities', value: exportData.meta.cities.map(c => c.city).join(', '), icon: 'fa-city', color: 'violet' },
                            { label: 'Data Size', value: estimateExportSize(exportData), icon: 'fa-weight-scale', color: 'amber' },
                            { label: 'Format', value: 'Chatbot Context', icon: 'fa-robot', color: 'emerald' },
                        ].map((card, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-4">
                                <div className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">{card.label}</div>
                                <div className="text-sm font-black text-slate-800">{card.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Two-column: API Call vs Manual Copy */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Option A: Call API Directly */}
                        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl p-5 border border-violet-200/50 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center text-xs font-black">A</div>
                                <h3 className="text-sm font-black text-violet-900">Call API Directly</h3>
                                <span className="px-2 py-0.5 bg-violet-200 text-violet-700 text-[9px] font-black uppercase tracking-wider rounded-md ml-auto">
                                    Recommended
                                </span>
                            </div>
                            <p className="text-xs text-violet-700/70 font-medium">
                                Sends data + prompt to the Gemini Deep Research API (Interactions API) directly from this app.
                                Results stream in real-time. Uses <code className="bg-violet-200/50 px-1 rounded text-[10px]">deep-research-pro-preview</code>.
                            </p>
                            <button
                                onClick={handleRunDeepResearch}
                                disabled={isResearching || !exportData}
                                className="w-full px-5 py-3.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20"
                            >
                                {isResearching ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin" />
                                        Research Running...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-bolt" />
                                        Run Deep Research via API
                                    </>
                                )}
                            </button>

                            {/* Cost warning */}
                            <div className="flex items-start gap-2 text-[10px] text-violet-600/60 font-semibold">
                                <i className="fa-solid fa-circle-info mt-0.5 flex-shrink-0" />
                                <span>Deep Research is an agentic flow that makes multiple API calls. This can take 2-5 minutes and incurs pay-as-you-go costs based on Gemini 3 Pro pricing.</span>
                            </div>
                        </div>

                        {/* Option B: Manual Copy */}
                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/50 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-slate-400 text-white flex items-center justify-center text-xs font-black">B</div>
                                <h3 className="text-sm font-black text-slate-700">Manual Copy & Paste</h3>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">
                                Copy the prompt + data to clipboard, then paste into Gemini Deep Research in your browser.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => copyToClipboard('both')}
                                    className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <i className={`fa-solid ${copied === 'both' ? 'fa-check text-emerald-500' : 'fa-paste'}`} />
                                    {copied === 'both' ? 'Copied!' : 'Copy Prompt + Data'}
                                </button>
                                <button
                                    onClick={() => copyToClipboard('prompt')}
                                    className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <i className={`fa-solid ${copied === 'prompt' ? 'fa-check text-emerald-500' : 'fa-scroll'}`} />
                                    {copied === 'prompt' ? 'Copied!' : 'Prompt Only'}
                                </button>
                                <button
                                    onClick={() => copyToClipboard('data')}
                                    className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <i className={`fa-solid ${copied === 'data' ? 'fa-check text-emerald-500' : 'fa-code'}`} />
                                    {copied === 'data' ? 'Copied!' : 'Data Only'}
                                </button>
                                <button
                                    onClick={downloadJson}
                                    className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-download" />
                                    JSON File
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 font-semibold">
                                💡 Open <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline">gemini.google.com</a> → Deep Research → Paste
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Deep Research Live Output */}
            {(isResearching || researchResult || researchError) && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${researchProgress?.phase === 'complete' ? 'bg-emerald-100 text-emerald-600' :
                            researchProgress?.phase === 'failed' ? 'bg-red-100 text-red-600' :
                                'bg-violet-100 text-violet-600'
                            }`}>
                            <i className={`fa-solid ${researchProgress?.phase === 'complete' ? 'fa-check' :
                                researchProgress?.phase === 'failed' ? 'fa-xmark' :
                                    'fa-satellite-dish'
                                }`} />
                        </div>
                        <h2 className="text-lg font-black text-slate-900">Deep Research Output</h2>

                        {/* Status badge */}
                        {researchProgress && (
                            <span className={`ml-auto px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${researchProgress.phase === 'complete' ? 'bg-emerald-100 text-emerald-700' :
                                researchProgress.phase === 'failed' ? 'bg-red-100 text-red-700' :
                                    'bg-violet-100 text-violet-700 animate-pulse'
                                }`}>
                                {researchPhaseConfig[researchProgress.phase]?.emoji} {researchPhaseConfig[researchProgress.phase]?.label}
                            </span>
                        )}
                    </div>

                    {/* Thinking summary */}
                    {researchProgress?.thought && researchProgress.phase !== 'complete' && (
                        <div className="bg-violet-50 rounded-xl p-4 flex items-start gap-3">
                            <i className="fa-solid fa-brain text-violet-400 mt-0.5" />
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1">Agent Thinking</div>
                                <p className="text-sm text-violet-700 font-medium">{researchProgress.thought}</p>
                            </div>
                        </div>
                    )}

                    {/* Interaction ID */}
                    {researchProgress?.interactionId && (
                        <div className="text-[10px] font-mono text-slate-400">
                            Interaction: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{researchProgress.interactionId}</code>
                        </div>
                    )}

                    {/* Streaming content */}
                    {(researchProgress?.contentSoFar || researchResult) && (
                        <div className="relative">
                            <div className="max-h-[600px] overflow-y-auto bg-slate-50 rounded-xl p-6 border border-slate-100">
                                <div className="prose prose-sm prose-slate max-w-none whitespace-pre-wrap text-sm leading-relaxed font-medium text-slate-700">
                                    {researchResult || researchProgress?.contentSoFar}
                                </div>
                                <div ref={resultEndRef} />
                            </div>

                            {/* Action buttons for result */}
                            {(researchResult || (researchProgress?.contentSoFar && researchProgress.contentSoFar.length > 100)) && (
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={() => copyToClipboard('result')}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-copy" />
                                        Copy Result
                                    </button>
                                    <button
                                        onClick={downloadResult}
                                        className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-download" />
                                        Download .md
                                    </button>
                                    {researchResult && (
                                        <span className="px-3 py-2 text-[10px] font-bold text-slate-400 ml-auto">
                                            {(researchResult.length / 1024).toFixed(1)} KB
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {researchError && (
                        <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm font-semibold space-y-2">
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-exclamation-triangle" />
                                <span>Deep Research failed</span>
                            </div>
                            <p className="text-xs text-red-600/80 font-medium">{researchError}</p>
                            <button
                                onClick={handleRunDeepResearch}
                                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-all flex items-center gap-2 mt-2"
                            >
                                <i className="fa-solid fa-rotate" />
                                Retry
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Step 3: Preview Panels */}
            {exportData && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-black">
                            <i className="fa-solid fa-eye text-xs" />
                        </div>
                        <h2 className="text-lg font-black text-slate-900">Data Preview</h2>
                        <div className="flex gap-1 ml-auto">
                            <button
                                onClick={() => setShowPreview(!showPreview)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${showPreview ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                {showPreview ? 'Hide' : 'Show'} Preview
                            </button>
                        </div>
                    </div>

                    {showPreview && (
                        <div className="space-y-4">
                            {/* Property summaries */}
                            <div className="max-h-96 overflow-y-auto bg-slate-50 rounded-xl p-4">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                                    Properties ({exportData.properties.length})
                                </h4>
                                <div className="space-y-2">
                                    {exportData.properties.map((p, i) => (
                                        <div key={p.zpid} className="flex items-center gap-3 text-sm py-2 border-b border-slate-100 last:border-0">
                                            <span className="w-8 text-xs text-slate-400 font-mono text-right">{i + 1}</span>
                                            <span className="font-semibold text-slate-800 flex-1 truncate">
                                                {p.address || p.zpid}
                                            </span>
                                            <div className="flex gap-1.5">
                                                {p.dataCoverage.hasMLS && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md">MLS</span>}
                                                {p.dataCoverage.hasVisual && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-md">Visual AI</span>}
                                                {p.dataCoverage.hasComprehensive && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-md">Comp</span>}
                                            </div>
                                            {p.price && (
                                                <span className="text-xs font-bold text-emerald-600">
                                                    ${(p.price / 1000).toFixed(0)}K
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Raw JSON preview */}
                            <details>
                                <summary className="cursor-pointer text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-700">
                                    Raw JSON Preview
                                </summary>
                                <textarea
                                    ref={textareaRef}
                                    readOnly
                                    value={JSON.stringify(exportData, null, 2)}
                                    className="w-full h-80 mt-2 p-4 bg-slate-900 text-green-400 text-xs font-mono rounded-xl border-0 resize-y"
                                />
                            </details>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ContextGraphTab;
