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
        <div className="space-y-8 pb-12 font-sans" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
            {/* STR Section Header */}
            <div className="flex items-center gap-3 pt-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <i className="fa-solid fa-calendar-check text-lg"></i>
                </div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Short-Term Rental</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                            <i className="fa-solid fa-tag text-lg"></i>
                        </div>
                    </div>
                    <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Target ADR</h4>
                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{specific.str_performance.adr}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                            <i className="fa-solid fa-chart-pie text-lg"></i>
                        </div>
                    </div>
                    <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Occupancy Rate</h4>
                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{specific.str_performance.occupancy_rate}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                            <i className="fa-solid fa-dollar-sign text-lg"></i>
                        </div>
                    </div>
                    <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Annual Revenue Projection</h4>
                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{specific.str_performance.annual_revenue_projection}</p>
                </div>
            </div>

            {/* LTR Section Header */}
            <div className="flex items-center gap-3 pt-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                    <i className="fa-solid fa-house-chimney-user text-lg"></i>
                </div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Long-Term Rental</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                            <i className="fa-solid fa-money-bill-wave text-lg"></i>
                        </div>
                    </div>
                    <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Monthly Rent</h4>
                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{specific.ltr_analysis.monthly_rent}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                            <i className="fa-solid fa-house-circle-xmark text-lg"></i>
                        </div>
                    </div>
                    <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Vacancy Rate</h4>
                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{specific.ltr_analysis.vacancy_rate}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                            <i className="fa-solid fa-scale-balanced text-lg"></i>
                        </div>
                    </div>
                    <h4 className="font-black text-gray-900 text-lg mb-2 tracking-tight">Stability Analysis</h4>
                    <p className="text-gray-700 font-sans font-normal text-[13px] leading-relaxed">{specific.ltr_analysis.comparison_summary}</p>
                </div>
            </div>
        </div>
    );
};
