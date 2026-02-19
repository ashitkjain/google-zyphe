import React, { useState } from 'react';
import { PropertySpecificInvestmentResult, DeepInvestmentResearchResult } from '../../../../types';
import { getCleanDomain } from './CommonComponents';

interface InvestmentViewProps {
    specific: PropertySpecificInvestmentResult;
    deepResearch: DeepInvestmentResearchResult;
}

export const InvestmentView: React.FC<InvestmentViewProps> = ({ specific, deepResearch }) => {
    const [showAllSources, setShowAllSources] = useState(false);
    const report = deepResearch?.structured_report;
    const macroSummary = report?.macroeconomic_indicators?.summary;
    const macroDetails = report?.macroeconomic_indicators?.details || [];
    const marketSummary = report?.market_dynamics?.summary;
    const marketDetails = report?.market_dynamics?.details || [];
    // Extract DOM from market_dynamics details (look for days on market mention)
    const domDetail = marketDetails.find(d => /days.on.market|DOM/i.test(d)) || marketSummary || '';
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

            {/* 2. Market Dynamics — from Deep Investment Research */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h5 className="text-[16px] font-bold text-[#1a2333] tracking-tight">Historical Growth</h5>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                            <i className="fa-solid fa-arrow-trend-up text-xs"></i>
                        </div>
                    </div>
                    <p className="text-gray-500 text-[13px] leading-relaxed font-normal flex-1">
                        {macroSummary || <span className="italic text-gray-300">Run Deep Research to populate</span>}
                    </p>
                    {macroDetails.length > 0 && (
                        <ul className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
                            {macroDetails.slice(0, 2).map((d, i) => (
                                <li key={i} className="text-[11px] text-gray-400 flex gap-2">
                                    <span className="text-amber-400 mt-0.5">•</span>{d}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h5 className="text-[16px] font-bold text-[#1a2333] tracking-tight">Forecasted Equity</h5>
                        <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                            <i className="fa-solid fa-bullseye text-xs"></i>
                        </div>
                    </div>
                    <p className="text-gray-500 text-[13px] leading-relaxed font-normal flex-1">
                        {report?.investment_outlook?.long_term || <span className="italic text-gray-300">Run Deep Research to populate</span>}
                    </p>
                    {report?.investment_outlook?.short_term && (
                        <div className="mt-3 border-t border-gray-50 pt-3">
                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-1">Short-Term (12M)</span>
                            <p className="text-[11px] text-gray-400">{report.investment_outlook.short_term}</p>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 flex flex-col h-full">
                    <div className="flex justify-between items-center mb-4">
                        <h5 className="text-[16px] font-bold text-[#1a2333] tracking-tight">Market Liquidity</h5>
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
                            <i className="fa-solid fa-clock text-xs"></i>
                        </div>
                    </div>
                    <p className="text-gray-500 text-[13px] leading-relaxed font-normal flex-1">
                        {domDetail || <span className="italic text-gray-300">Run Deep Research to populate</span>}
                    </p>
                    {marketDetails.length > 0 && (
                        <ul className="mt-3 space-y-1.5 border-t border-gray-50 pt-3">
                            {marketDetails.filter(d => !/days.on.market|DOM/i.test(d)).slice(0, 2).map((d, i) => (
                                <li key={i} className="text-[11px] text-gray-400 flex gap-2">
                                    <span className="text-gray-300 mt-0.5">•</span>{d}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};
