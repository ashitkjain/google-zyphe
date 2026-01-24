import React, { useState, useEffect } from 'react';

const BusinessImpactWidget: React.FC = () => {
    // Mock Data simulating revenue recovery
    const [stats, setStats] = useState({
        recoveredLeads: 12,
        pipelineValue: 4200000, // $4.2M
        conversionRate: 8.5
    });

    // Animate the counters on mount
    useEffect(() => {
        const interval = setInterval(() => {
            setStats(prev => ({
                ...prev,
                pipelineValue: prev.pipelineValue + Math.floor(Math.random() * 1000)
            }));
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
            notation: 'compact',
            compactDisplay: 'short'
        }).format(val);
    };

    return (
        <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-900/20 animate-in slide-in-from-left-4 duration-700">
            {/* Background Gradients */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-emerald-400 border border-white/5">
                            <i className="fa-solid fa-arrow-trend-up text-sm"></i>
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Ecosystem Impact</h3>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black tracking-tight text-white">
                            {formatCurrency(stats.pipelineValue)}
                        </span>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            +Recovered Pipeline
                        </span>
                    </div>
                    <p className="text-slate-400 text-xs font-medium max-w-xs leading-relaxed">
                        Total potential volume reactivated from your "Dead Lead" archive this quarter.
                    </p>
                </div>

                {/* Integration Status */}
                <div className="flex-1 w-full md:w-auto bg-white/5 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sync Status</span>
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Live Sync Active
                        </span>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs border border-indigo-500/30">
                                    <i className="fa-solid fa-user-check"></i>
                                </div>
                                <span className="text-xs font-bold text-slate-300">Reactivated Leads</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-white group-hover:text-indigo-300 transition-colors">
                                {stats.recoveredLeads} <i className="fa-solid fa-arrow-right text-[10px] mx-1 opacity-50"></i> CRM
                            </span>
                        </div>

                        <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs border border-amber-500/30">
                                    <i className="fa-solid fa-handshake"></i>
                                </div>
                                <span className="text-xs font-bold text-slate-300">Transactions</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-white group-hover:text-amber-300 transition-colors">
                                2 Closing
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusinessImpactWidget;
