import React from 'react';
import { CensusDemographics } from '../../../../services/api/environmental';

interface CensusDemographicsCardProps {
    data: CensusDemographics;
    compact?: boolean;
}

export const CensusDemographicsCard: React.FC<CensusDemographicsCardProps> = ({ data, compact = false }) => {
    const fmt = (v: number | null | undefined) => {
        if (v == null) return '—';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
    };

    const fmtNum = (v: number | null | undefined) => {
        if (v == null) return '—';
        return new Intl.NumberFormat('en-US').format(v);
    };

    const fmtPct = (v: number | null | undefined) => {
        if (v == null) return '—';
        return `${v}%`;
    };

    const METRICS = [
        { label: 'Median Household Income', value: fmt(data.medianHouseholdIncome), icon: 'fa-money-bill-trend-up', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Median Home Value', value: fmt(data.medianHomeValue), icon: 'fa-house-chimney-window', color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Median Gross Rent', value: fmt(data.medianGrossRent), icon: 'fa-building-user', color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'Total Population', value: fmtNum(data.totalPopulation), icon: 'fa-users', color: 'text-slate-600', bg: 'bg-slate-50' },
        { label: 'Owner-Occupied', value: fmtPct(data.ownerPct), icon: 'fa-house-user', color: 'text-violet-600', bg: 'bg-violet-50' },
        { label: 'Rent Burden (30%+)', value: fmtPct(data.rentBurdenPct), icon: 'fa-triangle-exclamation', color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Bachelors Degree+', value: fmtPct(data.bachelorsPlusPct), icon: 'fa-graduation-cap', color: 'text-sky-600', bg: 'bg-sky-50' },
        { label: 'Median Age', value: data.medianAge || '—', icon: 'fa-cake-candles', color: 'text-rose-600', bg: 'bg-rose-50' },
    ];

    if (compact) {
        return (
            <div className="bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <i className="fa-solid fa-users text-indigo-600 text-[11px]"></i>
                            </div>
                            <span className="text-[14px] font-bold text-slate-800 tracking-tight">Census Demographics</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                             {METRICS.slice(0, 4).map((m, i) => (
                                 <div key={i} className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                                     <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{m.label.replace('Median ', '')}</div>
                                     <div className={`text-[14px] font-black ${m.color}`}>{m.value}</div>
                                 </div>
                             ))}
                        </div>

                        {data.ownerPct != null && data.renterPct != null && (
                            <div className="mt-2">
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1">
                                    <span className="text-blue-600">Owner {data.ownerPct}%</span>
                                    <span className="text-amber-600">Renter {data.renterPct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${data.ownerPct}%` }}></div>
                                </div>
                            </div>
                        )}

                        <div className="text-[8px] text-slate-400 mt-2 text-right">
                             {data.tractLabel ? `${data.tractLabel} · ` : ''}ACS 5-Year
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[3rem] border border-gray-100 shadow-sm p-8 md:p-12 space-y-8">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <i className="fa-solid fa-chart-column text-indigo-600 text-lg"></i>
                </div>
                <div>
                    <div className="text-2xl font-black text-indigo-600 uppercase tracking-[0.3em]">CENSUS DEMOGRAPHICS</div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Official {data.tractLabel || 'Tract Area'} Metrics
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {METRICS.map((m, i) => (
                    <div key={i} className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg ${m.bg} flex items-center justify-center`}>
                                <i className={`fa-solid ${m.icon} ${m.color} text-[10px]`}></i>
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{m.label}</span>
                        </div>
                        <div className="text-xl font-black text-gray-900 leading-none">{m.value}</div>
                    </div>
                ))}
            </div>

            {data.insight && (
                <div className="pt-6 border-t border-gray-50 flex gap-4">
                    <i className="fa-solid fa-quote-left text-indigo-200 text-2xl shrink-0"></i>
                    <p className="text-sm text-gray-600 leading-relaxed italic">{data.insight}</p>
                </div>
            )}
        </div>
    );
};
