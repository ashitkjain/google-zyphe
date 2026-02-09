import React, { useState } from 'react';
import { PropertySpecificInvestmentResult, GeneralMarketIntelligenceResult } from '../../../../types';
import { getCleanDomain } from './CommonComponents';

interface InvestmentViewProps {
    specific: PropertySpecificInvestmentResult;
    general: GeneralMarketIntelligenceResult;
}

export const InvestmentView: React.FC<InvestmentViewProps> = ({ specific, general }) => {
    const [showAllSources, setShowAllSources] = useState(false);
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-700 max-w-5xl mx-auto space-y-8 pb-12 font-sans" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
            {/* 1. Key Performance Comparison (STR vs LTR) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-[0_8px_40px_rgb(0,0,0,0.04)] overflow-hidden p-10 space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <i className="fa-solid fa-calendar-check text-sm"></i>
                        </div>
                        <h4 className="text-2xl font-bold text-[#1a2333] tracking-tight">Short-Term Rental</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100/50">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-3">TARGET ADR</span>
                            <p className="text-[14px] font-normal leading-[1.625] text-gray-700">{specific.str_performance.adr}</p>
                        </div>
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100/50">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-3">OCC. RATE</span>
                            <p className="text-[14px] font-normal leading-[1.625] text-gray-700">{specific.str_performance.occupancy_rate}</p>
                        </div>
                    </div>

                    <div className="p-8 bg-[#1a2333] rounded-2xl shadow-xl shadow-indigo-900/10">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-3">ANNUAL REVENUE PROJECTION</span>
                        <p className="text-[19px] font-bold text-white leading-relaxed">{specific.str_performance.annual_revenue_projection}</p>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-[0_8px_40px_rgb(0,0,0,0.04)] overflow-hidden p-10 space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                            <i className="fa-solid fa-house-chimney-user text-sm"></i>
                        </div>
                        <h4 className="text-2xl font-bold text-[#1a2333] tracking-tight">Long-Term Rental</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100/50">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-3">MONTHLY RENT</span>
                            <p className="text-[14px] font-normal leading-[1.625] text-gray-700">{specific.ltr_analysis.monthly_rent}</p>
                        </div>
                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100/50">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-3">VACANCY RATE</span>
                            <p className="text-[14px] font-normal leading-[1.625] text-gray-700">{specific.ltr_analysis.vacancy_rate}</p>
                        </div>
                    </div>

                    <div className="p-8 bg-teal-50 rounded-2xl border border-teal-100/50">
                        <span className="text-[11px] font-bold text-teal-600 uppercase tracking-widest block mb-3">STABILITY ANALYSIS</span>
                        <p className="text-[14px] font-normal leading-[1.625] text-teal-900/80">{specific.ltr_analysis.comparison_summary}</p>
                    </div>
                </div>
            </div>

            {/* 2. Market Dynamics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h5 className="text-[16px] font-bold text-[#1a2333] tracking-tight">Historical Growth</h5>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                            <i className="fa-solid fa-arrow-trend-up text-xs"></i>
                        </div>
                    </div>
                    <p className="text-gray-500 text-[13px] leading-relaxed font-normal">
                        {general.market_dynamics.historical_appreciation}
                    </p>
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h5 className="text-[16px] font-bold text-[#1a2333] tracking-tight">Forecasted Equity</h5>
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                            <i className="fa-solid fa-bullseye text-xs"></i>
                        </div>
                    </div>
                    <p className="text-gray-500 text-[13px] leading-relaxed font-normal">
                        {general.market_dynamics.projected_growth}
                    </p>
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h5 className="text-[16px] font-bold text-[#1a2333] tracking-tight">Market Liquidity</h5>
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
                            <i className="fa-solid fa-clock text-xs"></i>
                        </div>
                    </div>
                    <p className="text-gray-500 text-[13px] leading-relaxed font-normal">
                        {general.market_dynamics.days_on_market}
                    </p>
                </div>
            </div>

            {/* 3. Detailed Insights Grid */}
            <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    <div className="space-y-4">
                        <h4 className="text-lg font-bold text-[#1a2333] tracking-tight">Regulatory & Growth</h4>
                        <p className="text-gray-600 text-[15px] leading-relaxed">{general.regulatory_and_growth.summary}</p>
                        <div className="space-y-3">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-[11px] font-bold text-[#1a2333]/50 uppercase tracking-widest block mb-1">Laws & Zoning</span>
                                <p className="text-[14px] leading-relaxed text-[#1a2333]/70">{general.regulatory_and_growth.laws_and_zoning}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-[11px] font-bold text-[#1a2333]/50 uppercase tracking-widest block mb-1">Infrastructure</span>
                                <p className="text-[14px] leading-relaxed text-[#1a2333]/70">{general.regulatory_and_growth.upcoming_developments}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-lg font-bold text-[#1a2333] tracking-tight">Competitive Edge</h4>
                        <p className="text-gray-600 text-[15px] leading-relaxed">{general.competitor_gaps.recommendations}</p>
                        <div className="mt-4 space-y-4">
                            <div>
                                <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest block mb-2">Highly Praised Amenities</span>
                                <div className="flex flex-wrap gap-2">
                                    {(general.competitor_gaps?.praised_amenities || []).map((a, i) => (
                                        <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[12px] font-bold rounded-lg border border-indigo-100">{a}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="text-[11px] font-bold text-rose-500 uppercase tracking-widest block mb-2">Friction Points</span>
                                <ul className="space-y-1.5">
                                    {(general.competitor_gaps?.friction_points || []).map((p, i) => (
                                        <li key={i} className="text-[14px] text-gray-500 flex gap-2">
                                            <span className="text-rose-400">•</span> {p}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-lg font-bold text-[#1a2333] tracking-tight">Peak Demand Drivers</h4>
                        <div className="space-y-4">
                            {(general.demand_drivers || []).map((d, i) => (
                                <div key={i} className="flex flex-col border-l-2 border-indigo-100 pl-4 py-0.5 group hover:border-[#1a2333] transition-colors">
                                    <div className="text-[15px] font-bold text-[#1a2333] mb-0.5">{d.event}</div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-indigo-600 font-bold uppercase tracking-widest">{d.date}</span>
                                        <span className="text-gray-400 font-medium uppercase tracking-tighter">{d.impact}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. External Sources */}
            <div className="flex flex-col items-center gap-4">
                <div className="flex flex-wrap gap-2 justify-center max-w-3xl">
                    {general.web_sources?.slice(0, showAllSources ? undefined : 2).map((source, i) => (
                        <a
                            key={i}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-white border border-gray-100 rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center gap-2 group shadow-sm"
                        >
                            <i className="fa-solid fa-link text-[8px] group-hover:animate-pulse"></i>
                            {source.title || getCleanDomain(source.url)}
                        </a>
                    ))}
                </div>

                {general.web_sources && general.web_sources.length > 2 && (
                    <button
                        onClick={() => setShowAllSources(!showAllSources)}
                        className="text-[11px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors flex items-center gap-2"
                    >
                        {showAllSources ? (
                            <>Show Less <i className="fa-solid fa-chevron-up"></i></>
                        ) : (
                            <>{general.web_sources.length - 2} more sources <i className="fa-solid fa-chevron-down"></i></>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};
