import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MitLivingWageResult } from '../../../../prompts/property/mitLivingWage';

interface AffordabilityCardProps {
    county?: string;
    state?: string;
    city?: string;
    countyFips?: string;
    metroCode?: string;
    metroName?: string;
    data?: MitLivingWageResult;
    userId?: string;
    compact?: boolean;
}

const fmt = (n: number | undefined | null) =>
    n != null ? `$${Math.round(n).toLocaleString('en-US')}` : '—';

const fmtHr = (n: number | undefined | null) =>
    n != null ? `$${n.toFixed(2)}/hr` : '—';

const pct = (val: number, total: number) =>
    total > 0 ? Math.round((val / total) * 100) : 0;

const ROWS = [
    { key: 'housing',        label: 'Housing',           icon: 'fa-house',        bar: 'bg-indigo-400',  color: 'text-indigo-700'  },
    { key: 'child_care',     label: 'Child Care',        icon: 'fa-children',     bar: 'bg-pink-400',    color: 'text-pink-700'    },
    { key: 'food',           label: 'Food',              icon: 'fa-utensils',     bar: 'bg-emerald-400', color: 'text-emerald-700' },
    { key: 'transportation', label: 'Transport',         icon: 'fa-car',          bar: 'bg-amber-400',   color: 'text-amber-700'   },
    { key: 'medical',        label: 'Medical',           icon: 'fa-heart-pulse',  bar: 'bg-rose-400',    color: 'text-rose-700'    },
    { key: 'civic',          label: 'Civic',             icon: 'fa-people-group', bar: 'bg-purple-400',  color: 'text-purple-700'  },
    { key: 'broadband',      label: 'Internet & Mobile', icon: 'fa-wifi',         bar: 'bg-sky-400',     color: 'text-sky-700'     },
    { key: 'other',          label: 'Other',             icon: 'fa-ellipsis',     bar: 'bg-gray-300',    color: 'text-gray-500'    },
] as const;

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />
);

export const AffordabilityCard: React.FC<AffordabilityCardProps> = ({
    county, state, city, countyFips, metroCode, metroName, data: dataProp, userId, compact = false
}) => {
    const [data, setData] = useState<MitLivingWageResult | null>(dataProp ?? null);
    const [loading, setLoading] = useState(!dataProp);
    const [error, setError] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const locationLabel = [city, state].filter(Boolean).join(', ') || 'this area';
    const resolvedCounty = county || city || 'this county';
    const resolvedState = state || 'CA';

    const load = useCallback(async () => {
        if (dataProp) { setData(dataProp); setLoading(false); return; }
        setLoading(true); setError(null);
        try {
            const { fetchMitLivingWage } = await import('../../../../services/geminiService');
            const result = await fetchMitLivingWage(
                { city, county: resolvedCounty, state: resolvedState, countyFips, metroCode, metroName },
                userId
            );
            setData(result.data);
        } catch (e: any) {
            setError('Could not load cost-of-living data.');
        } finally {
            setLoading(false);
        }
    }, [dataProp, city, resolvedCounty, resolvedState, countyFips, metroCode, metroName, userId]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className={`bg-white rounded-xl border border-slate-100/80 p-5 space-y-3 ${compact ? 'shadow-sm' : ''}`}>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-8 w-36" />
                <div className="grid grid-cols-3 gap-2 mt-3">
                    {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
            </div>
        );
    }

    if (error || !data || !data.expenses) {
        return (
            <div className="bg-white rounded-xl border border-slate-100/80 p-6 text-center space-y-3">
                <i className="fa-solid fa-triangle-exclamation text-amber-400 text-xl" />
                <p className="text-sm text-slate-500">{error || 'Data unavailable'}</p>
                <button onClick={load} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">Retry</button>
            </div>
        );
    }

    const mo = (annual: number) => Math.round(annual / 12);
    const { required_annual_income_before_taxes: reqIncome, ...spendingItems } = data.expenses as any;
    const total = (Object.values(spendingItems) as number[]).reduce((s, v) => typeof v === 'number' && v > 0 ? s + v : s, 0);

    if (compact) {
        return (
            <div className="bg-white rounded-xl border border-slate-100/80 p-3 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="bg-slate-50/50 rounded-xl border border-slate-100/80 overflow-hidden shadow-sm">
                    <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <i className="fa-solid fa-scale-balanced text-indigo-600 text-[11px]"></i>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[16px] font-black text-slate-700 tracking-tight leading-none">Affordability</span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
                                    {data.location_name || metroName || resolvedCounty}
                                </span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 whitespace-nowrap">Monthly Exp</div>
                                <div className="text-[14px] font-black text-indigo-600 leading-none">{fmt(mo(total))}</div>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-100 text-center">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 whitespace-nowrap">Req. Income</div>
                                <div className="text-[14px] font-black text-emerald-600 leading-none">{fmt(reqIncome)}</div>
                            </div>
                        </div>

                        {/* Collapsible details toggle */}
                        <button
                            onClick={() => setDetailsOpen(o => !o)}
                            className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <span>{detailsOpen ? 'Hide Details' : 'Show Details'}</span>
                            <i className={`fa-solid fa-chevron-${detailsOpen ? 'up' : 'down'} text-[8px]`} />
                        </button>

                        {detailsOpen && (
                            <>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-1">
                                     {ROWS.map(({ key, label, icon, color }) => {
                                         const annual = (data.expenses as any)[key] as number;
                                         if (!annual && annual !== 0) return null;
                                         return (
                                             <div key={key} className="flex items-center justify-between gap-2">
                                                 <div className="flex items-center gap-1.5 min-w-0">
                                                     <div className="w-3.5 flex justify-center flex-shrink-0">
                                                        <i className={`fa-solid ${icon} text-[9px] ${color} shrink-0`} />
                                                     </div>
                                                     <span className="text-[10px] text-slate-500 font-medium truncate">{label}</span>
                                                 </div>
                                                 <span className={`text-[10px] font-black ${color} shrink-0`}>{fmt(mo(annual))}</span>
                                             </div>
                                         );
                                     })}
                                </div>

                                <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                                    <div className="text-[9px] text-slate-400 font-bold italic uppercase tracking-wider">
                                        2 Adults, 2 Kids · Working
                                    </div>
                                    {data.source_url && (
                                        <a 
                                            href={data.source_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="text-[9px] text-indigo-400 hover:text-indigo-600 font-black uppercase tracking-widest flex items-center gap-1"
                                        >
                                            Source: MIT survey <i className="fa-solid fa-arrow-up-right-from-square text-[7px]" />
                                        </a>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden p-8 md:p-12 space-y-8">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <i className="fa-solid fa-scale-balanced text-indigo-600 text-lg"></i>
                </div>
                <div>
                    <div className="text-2xl font-black text-indigo-600 uppercase tracking-[0.3em]">MIT LIVING WAGE</div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Cost of Living: {locationLabel}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {ROWS.map(({ key, label, icon, bar, color }) => {
                    const annual = (data.expenses as any)[key] as number | undefined;
                    if (!annual && annual !== 0) return null;
                    const monthly = mo(annual);
                    return (
                        <div key={key} className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center`}>
                                    <i className={`fa-solid ${icon} ${color} text-[10px]`}></i>
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest truncate">{label}</span>
                            </div>
                            <div className="text-xl font-black text-gray-900 leading-none">{fmt(monthly)}<span className="text-[11px] font-medium text-gray-400 ml-1">/mo</span></div>
                        </div>
                    );
                })}
            </div>

            {/* Required income */}
            <div className="pt-8 border-t border-gray-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex gap-4">
                    <i className="fa-solid fa-circle-info text-indigo-200 text-2xl shrink-0"></i>
                    <div>
                        <p className="text-sm font-black text-slate-800 uppercase tracking-wider">Required Annual Income</p>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">Before-tax income for: 2 Adults (Both Working) & 2 Children</p>
                    </div>
                </div>
                <div className="text-right bg-indigo-50/50 px-6 py-4 rounded-3xl border border-indigo-100">
                    <div className="text-3xl font-black text-indigo-600">{fmt(reqIncome)}</div>
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Per Year</div>
                </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 opacity-50">
                 <div className="text-[10px] text-slate-400 font-bold italic uppercase tracking-wider">
                    Source: MIT Living Wage Calculator · {data.data_updated || '2024'}
                 </div>
                 {data.source_url && (
                     <a href={data.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:text-indigo-600 font-black uppercase tracking-widest">
                         View Source <i className="fa-solid fa-arrow-up-right-from-square ml-1" />
                     </a>
                 )}
            </div>
        </div>
    );
};

export default AffordabilityCard;
