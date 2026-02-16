import React from 'react';
import { DeepInvestmentResearchResult } from '../../../../types';

interface DeepInvestmentViewProps {
    data: DeepInvestmentResearchResult;
}

export const DeepInvestmentView: React.FC<DeepInvestmentViewProps> = ({ data }) => {
    const renderMarkdown = (content: any) => {
        if (typeof content !== 'string') return JSON.stringify(content, null, 2);

        // Fix for literal \n sequences and escaped characters like \$
        const processedContent = content
            .replace(/\\n/g, '\n')
            .replace(/\\(\$|#|\*|_|\[|\])/g, '$1');

        const lines = processedContent.split('\n');
        return lines.map((line, idx) => {
            // Horizontal rule
            if (line.trim() === '---') {
                return <hr key={idx} className="my-8 border-gray-100" />;
            }

            // Headers
            if (line.startsWith('# ')) {
                return <h1 key={idx} className="text-3xl font-black text-gray-900 mt-12 mb-6 tracking-tight border-b border-gray-50 pb-4">{line.slice(2)}</h1>;
            }
            if (line.startsWith('## ')) {
                const title = line.slice(3).trim();
                const isMicroMarkets = title.toLowerCase().includes('micro-market');
                const isLocalRisks = title.toLowerCase().includes('local risk');

                return (
                    <div key={idx} className={`mt-10 mb-6 pb-2 border-b ${isLocalRisks ? 'border-red-100' : 'border-gray-50'}`}>
                        <div className="flex items-center gap-3">
                            {isMicroMarkets && <i className="fa-solid fa-archway text-indigo-400 text-sm"></i>}
                            {isLocalRisks && <i className="fa-solid fa-triangle-exclamation text-rose-400 text-sm animate-pulse"></i>}
                            <h2 className={`text-2xl font-black tracking-tight ${isLocalRisks ? 'text-rose-600' : 'text-gray-800'}`}>
                                {isMicroMarkets ? 'Neighborhood Intelligence: ' : ''}{title}
                            </h2>
                        </div>
                    </div>
                );
            }
            if (line.startsWith('### ')) {
                return (
                    <div key={idx} className="flex items-center gap-2 mt-8 mb-3">
                        <div className="w-1 h-6 bg-indigo-500 rounded-full opacity-20"></div>
                        <h3 className="text-xl font-black text-gray-800 tracking-tight">{line.slice(4)}</h3>
                    </div>
                );
            }

            // Bullet points
            if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
                const bulletContent = line.trim().slice(2);
                return (
                    <div key={idx} className="flex gap-3 mb-2 ml-4">
                        <span className="text-indigo-400 mt-1.5">•</span>
                        <div className="flex-1">
                            {renderTextWithBold(bulletContent)}
                        </div>
                    </div>
                );
            }

            // Paragraph
            if (line.trim() === '') return <div key={idx} className="h-4" />;

            return (
                <p key={idx} className="mb-4 leading-[1.8] text-gray-700 font-medium">
                    {renderTextWithBold(line)}
                </p>
            );
        });
    };

    const renderTextWithBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*|__.*?__)/);
        return parts.map((part, i) => {
            if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
                return <strong key={i} className="font-extrabold text-gray-900">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-5xl mx-auto space-y-8 pb-12 font-sans" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-[0_8px_40px_rgb(0,0,0,0.04)] overflow-hidden p-10 space-y-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <i className="fa-solid fa-magnifying-glass-chart text-xl"></i>
                    </div>
                    <div className="flex flex-col">
                        <h4 className="text-2xl font-black text-[#1a2333] tracking-tight">Investment Research</h4>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Grounded AI Analysis • Short & Long Term</p>
                    </div>
                </div>

                <div className="prose prose-slate max-w-none">
                    <div className="text-gray-700 font-sans font-normal leading-[1.8] text-[15px] selection:bg-indigo-100 selection:text-indigo-900">
                        {data.status === 'running' ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6">
                                    <i className="fa-solid fa-circle-notch animate-spin text-2xl text-indigo-500"></i>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 mb-2">Deep Research in Progress</h3>
                                <p className="text-slate-500 font-medium text-center max-w-sm">
                                    Our AI agents are currently scouring urban planning documents and market historicals. This typically takes 2-5 minutes.
                                </p>
                            </div>
                        ) : data.structured_report ? (
                            <div className="space-y-12">
                                {/* Macro & Market Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex flex-col gap-4">
                                        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <i className="fa-solid fa-chart-line text-indigo-500"></i>
                                                <h3 className="text-lg font-black text-slate-800">Macroeconomics</h3>
                                            </div>
                                            <p className="text-slate-600 mb-6 font-medium leading-relaxed">{data.structured_report.macroeconomic_indicators.summary}</p>
                                            <ul className="space-y-3">
                                                {data.structured_report.macroeconomic_indicators.details.map((d, i) => (
                                                    <li key={i} className="flex gap-2 text-sm text-slate-500">
                                                        <span className="text-indigo-400">•</span>
                                                        {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        {data.structured_report.macroeconomic_indicators.visual_hint && (
                                            <div className="h-48 bg-slate-900/5 rounded-[1.5rem] border border-slate-200 border-dashed flex flex-col items-center justify-center p-6 transition-all hover:bg-slate-900/[0.07]">
                                                <i className="fa-solid fa-chart-area text-slate-300 text-3xl mb-3"></i>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Data Projection: {data.structured_report.macroeconomic_indicators.visual_hint}</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <i className="fa-solid fa-house-chimney-window text-indigo-500"></i>
                                                <h3 className="text-lg font-black text-slate-800">Market Dynamics</h3>
                                            </div>
                                            <p className="text-slate-600 mb-6 font-medium leading-relaxed">{data.structured_report.market_dynamics.summary}</p>
                                            <ul className="space-y-3">
                                                {data.structured_report.market_dynamics.details.map((d, i) => (
                                                    <li key={i} className="flex gap-2 text-sm text-slate-500">
                                                        <span className="text-indigo-400">•</span>
                                                        {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        {data.structured_report.market_dynamics.visual_hint && (
                                            <div className="h-48 bg-slate-900/5 rounded-[1.5rem] border border-slate-200 border-dashed flex flex-col items-center justify-center p-6 transition-all hover:bg-slate-900/[0.07]">
                                                <i className="fa-solid fa-chart-bar text-slate-300 text-3xl mb-3"></i>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Market Heatmap: {data.structured_report.market_dynamics.visual_hint}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Demographics & Infrastructure */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex flex-col gap-4">
                                        <div className="p-8 bg-indigo-50/30 rounded-[2rem] border border-indigo-100/50 flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <i className="fa-solid fa-people-group text-indigo-500"></i>
                                                <h3 className="text-lg font-black text-slate-800">Demographic Shifts</h3>
                                            </div>
                                            <p className="text-slate-600 mb-6 font-medium">{data.structured_report.demographic_shifts.summary}</p>
                                            <ul className="space-y-3">
                                                {data.structured_report.demographic_shifts.details.map((d, i) => (
                                                    <li key={i} className="text-sm text-slate-500 flex gap-2">
                                                        <span className="text-indigo-400">•</span> {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        {data.structured_report.demographic_shifts.visual_hint && (
                                            <div className="h-40 bg-indigo-500/5 rounded-[1.5rem] border border-indigo-200 border-dashed flex flex-col items-center justify-center p-6">
                                                <i className="fa-solid fa-users-rays text-indigo-200 text-2xl mb-2"></i>
                                                <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest text-center">{data.structured_report.demographic_shifts.visual_hint}</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <div className="p-8 bg-indigo-50/30 rounded-[2rem] border border-indigo-100/50 flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <i className="fa-solid fa-bridge text-indigo-500"></i>
                                                <h3 className="text-lg font-black text-slate-800">Infrastructure</h3>
                                            </div>
                                            <p className="text-slate-600 mb-6 font-medium">{data.structured_report.infrastructure_and_development.summary}</p>
                                            <ul className="space-y-3">
                                                {data.structured_report.infrastructure_and_development.details.map((d, i) => (
                                                    <li key={i} className="text-sm text-slate-500 flex gap-2">
                                                        <span className="text-indigo-400">•</span> {d}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        {data.structured_report.infrastructure_and_development.visual_hint && (
                                            <div className="h-40 bg-indigo-500/5 rounded-[1.5rem] border border-indigo-200 border-dashed flex flex-col items-center justify-center p-6">
                                                <i className="fa-solid fa-map-location-dot text-indigo-200 text-2xl mb-2"></i>
                                                <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest text-center">{data.structured_report.infrastructure_and_development.visual_hint}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Micro Markets */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                                        <h3 className="text-xl font-black text-slate-800">Neighborhood Intelligence</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {data.structured_report.micro_markets.map((m, i) => (
                                            <div key={i} className="flex flex-col gap-4">
                                                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex-1">
                                                    <h4 className="font-black text-slate-900 mb-2">{m.name}</h4>
                                                    <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">{m.profile}</div>
                                                    <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">{m.investment_thesis}</p>
                                                </div>
                                                {m.visual_hint && (
                                                    <div className="h-32 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center p-4">
                                                        <i className="fa-solid fa-image text-slate-200 text-xl mb-1"></i>
                                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-tighter text-center line-clamp-2">{m.visual_hint}</div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Outlook & Risks */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="flex flex-col gap-4">
                                        <div className="p-8 bg-slate-950 rounded-[2rem] text-white flex-1">
                                            <div className="flex items-center gap-3 mb-6">
                                                <i className="fa-solid fa-compass text-indigo-400"></i>
                                                <h3 className="text-lg font-black">Investment Outlook</h3>
                                            </div>
                                            <div className="space-y-6">
                                                <div>
                                                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 font-mono">Short-Term (12M)</div>
                                                    <p className="text-sm text-slate-300 font-medium leading-relaxed">{data.structured_report.investment_outlook.short_term}</p>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-2 font-mono">Long-Term (5Y)</div>
                                                    <p className="text-sm text-slate-300 font-medium leading-relaxed">{data.structured_report.investment_outlook.long_term}</p>
                                                </div>
                                            </div>
                                        </div>
                                        {data.structured_report.investment_outlook.visual_hint && (
                                            <div className="h-32 bg-slate-900 rounded-[1.5rem] border border-slate-800 flex flex-col items-center justify-center p-4">
                                                <i className="fa-solid fa-arrow-trend-up text-indigo-500/50 text-2xl mb-1"></i>
                                                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">{data.structured_report.investment_outlook.visual_hint}</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        <div className="p-8 bg-rose-50 rounded-[2rem] border border-rose-100 flex-1">
                                            <div className="flex items-center gap-3 mb-4">
                                                <i className="fa-solid fa-triangle-exclamation text-rose-500"></i>
                                                <h3 className="text-lg font-black text-rose-900">Local Risks</h3>
                                            </div>
                                            <p className="text-rose-800/80 mb-6 text-sm font-medium leading-relaxed">{data.structured_report.local_risks.summary}</p>
                                            <ul className="space-y-2">
                                                {data.structured_report.local_risks.risk_factors.map((r, i) => (
                                                    <li key={i} className="text-xs text-rose-700 font-bold flex gap-2">
                                                        <span className="opacity-50">!</span> {r}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        {data.structured_report.local_risks.visual_hint && (
                                            <div className="h-32 bg-rose-100/50 rounded-[1.5rem] border border-rose-200 border-dashed flex flex-col items-center justify-center p-4">
                                                <i className="fa-solid fa-map text-rose-300 text-2xl mb-1"></i>
                                                <div className="text-[8px] font-black text-rose-400 uppercase tracking-widest text-center">{data.structured_report.local_risks.visual_hint}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Full content fallback if needed at the bottom */}
                                <div className="pt-12 border-t border-slate-100">
                                    <details className="group cursor-pointer">
                                        <summary className="list-none flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-500 transition-colors">
                                            <i className="fa-solid fa-chevron-right group-open:rotate-90 transition-transform"></i>
                                            View Full Grounded Report
                                        </summary>
                                        <div className="mt-8 pt-8 border-t border-slate-50 opacity-60">
                                            {renderMarkdown(data.content)}
                                        </div>
                                    </details>
                                </div>
                            </div>
                        ) : data.content ? (
                            renderMarkdown(data.content)
                        ) : (Object.keys(data).some(k => /^\d+$/.test(k))) ? (
                            // Auto-heal mangled character maps from previous spread bugs
                            renderMarkdown(
                                Object.entries(data)
                                    .filter(([k]) => /^\d+$/.test(k))
                                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                                    .map(([_, v]) => v)
                                    .join('')
                            )
                        ) : (
                            <div className="p-8 bg-rose-50 rounded-2xl border border-rose-100">
                                <h3 className="text-rose-900 font-black mb-2 flex items-center gap-2">
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                    Data Transparency Check
                                </h3>
                                <p className="text-rose-700 text-sm mb-4">The research content field is empty, but a record exists. Below is the raw data for diagnostic purposes:</p>
                                <pre className="p-4 bg-white/50 rounded-xl text-xs font-mono overflow-auto max-h-96">
                                    {JSON.stringify(data, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-8 border-t border-gray-50 flex items-center justify-between">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                        Source: Gemini Deep Research Agent {data.status === 'running' ? '(ACTIVE)' : ''}
                    </div>
                    {data.lastUpdated && (
                        <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest font-mono">
                            Processed: {new Date(data.lastUpdated?.seconds * 1000 || Date.now()).toLocaleDateString()}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .prose div {
                    color: #334155;
                }
                .prose strong {
                    color: #0f172a;
                    font-weight: 800;
                }
                .prose h1, .prose h2, .prose h3 {
                    color: #1e293b;
                    font-weight: 900;
                }
            `}</style>
        </div>
    );
};
