
import React from 'react';

const MarketAnalysisTab: React.FC = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Market Intelligence</h1>
                <p className="text-slate-500 font-medium">Advanced market trends and demographic analytics for investors.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <i className="fa-solid fa-chart-line"></i>
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px]">Price Appreciation</h3>
                    </div>
                    <div className="text-2xl font-black text-slate-900">+12.4%</div>
                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1 italic">Rising Demand</p>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <i className="fa-solid fa-people-group"></i>
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px]">Population Growth</h3>
                    </div>
                    <div className="text-2xl font-black text-slate-900">4.2% YoY</div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Expanding Market</p>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                            <i className="fa-solid fa-percent"></i>
                        </div>
                        <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px]">Inventory Levels</h3>
                    </div>
                    <div className="text-2xl font-black text-slate-900">1.8 Months</div>
                    <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-1 italic">Extreme Seller's Market</p>
                </div>
            </div>

            <div className="bg-white/50 border border-slate-200 rounded-[2.5rem] p-12 text-center border-dashed">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                    <i className="fa-solid fa-map-location-dot text-2xl"></i>
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">Detailed Heatmaps Coming Soon</h2>
                <p className="text-slate-500 max-w-sm mx-auto font-medium">
                    We are integrating neighborhood-level yield heatmaps and vacancy rate overlays. Stay tuned for the next update.
                </p>
            </div>
        </div>
    );
};

export default MarketAnalysisTab;
