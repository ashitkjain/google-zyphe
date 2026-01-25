import React from 'react';
import { Lead } from '../../../types';
import SentimentAnalyzer from './components/SentimentAnalyzer';

interface AnalyticsModuleProps {
    realtorId: string;
    leads: Lead[];
}

const AnalyticsModule: React.FC<AnalyticsModuleProps> = ({ realtorId, leads }) => {
    // Mock data for impact
    const stats = [
        { label: 'Avg. Response Rate', value: '31.4%', trend: '+8.2%', icon: 'fa-reply-all', color: 'blue' },
        { label: 'Reactivation Lift', value: '14.2%', trend: '+2.1%', icon: 'fa-bolt-lightning', color: 'emerald' },
        { label: 'Channel RoI', value: '11.4x', trend: '+0.8x', icon: 'fa-chart-pie', color: 'indigo' },
        { label: 'Database Health', value: '94.8', trend: '+12.4', icon: 'fa-heart-pulse', color: 'rose' }
    ];

    const colorMap: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        rose: 'bg-rose-50 text-rose-600'
    };

    const bgMap: Record<string, string> = {
        blue: 'bg-blue-500/5 group-hover:bg-blue-500/10',
        emerald: 'bg-emerald-500/5 group-hover:bg-emerald-500/10',
        indigo: 'bg-indigo-500/5 group-hover:bg-indigo-500/10',
        rose: 'bg-rose-500/5 group-hover:bg-rose-500/10'
    };

    return (
        <div className="space-y-10">
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500">
                        <div className={`w-12 h-12 rounded-2xl ${colorMap[stat.color]} flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-500`}>
                            <i className={`fa-solid ${stat.icon} text-lg`}></i>
                        </div>
                        <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{stat.label}</div>
                        <div className="flex items-baseline gap-3">
                            <div className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</div>
                            <div className={`text-[11px] font-black ${stat.trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {stat.trend}
                            </div>
                        </div>
                        {/* Decorative background element */}
                        <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${bgMap[stat.color]} rounded-full blur-2xl transition-all duration-500`}></div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Channel Affinity */}
                <div className="col-span-12 lg:col-span-7 bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Channel Performance</h3>
                            <p className="text-xs font-medium text-slate-500 mt-1">Efficiency breakdown by communication medium.</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Updates</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {(() => {
                            const barBgMap: Record<string, string> = {
                                emerald: 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]',
                                blue: 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]',
                                green: 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]',
                                rose: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                            };
                            const iconColorMap: Record<string, string> = {
                                emerald: 'text-emerald-500',
                                blue: 'text-blue-500',
                                green: 'text-green-500',
                                rose: 'text-rose-500'
                            };

                            return [
                                { name: 'SMS / Texting', percentage: 78, color: 'emerald', icon: 'fa-message' },
                                { name: 'Direct Email', percentage: 42, color: 'blue', icon: 'fa-envelope' },
                                { name: 'WhatsApp', percentage: 65, color: 'green', icon: 'fa-whatsapp' },
                                { name: 'Direct Call', percentage: 31, color: 'rose', icon: 'fa-phone' }
                            ].map((item, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-600">
                                        <div className="flex items-center gap-3">
                                            <i className={`fa-solid ${item.icon} ${iconColorMap[item.color]} w-4`}></i>
                                            <span>{item.name}</span>
                                        </div>
                                        <span className="text-slate-900">{item.percentage}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                                        <div
                                            className={`h-full rounded-full ${barBgMap[item.color]} transition-all duration-1000 ease-out`}
                                            style={{ width: `${item.percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {/* Conversion Summary */}
                <div className="col-span-12 lg:col-span-5 bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-200">
                    <div className="relative z-10">
                        <h3 className="text-xl font-black tracking-tight mb-2">Total Value Rescued</h3>
                        <p className="text-indigo-100/70 text-sm font-medium mb-8">Estimated pipeline value from reactivated leads.</p>

                        <div className="text-5xl font-black mb-8 tracking-tighter">
                            $1,248,500
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Active Revivals</div>
                                <div className="text-lg font-black underline decoration-indigo-400 decoration-2 underline-offset-4">42</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Closing Propensity</div>
                                <div className="text-lg font-black text-emerald-300">High</div>
                            </div>
                        </div>

                        <button className="w-full mt-10 py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors shadow-lg shadow-black/10">
                            Download Full Report
                        </button>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl -ml-24 -mb-24"></div>
                </div>
            </div>

            {/* AI Intent Lab */}
            <SentimentAnalyzer />
        </div>
    );
};

export default AnalyticsModule;
