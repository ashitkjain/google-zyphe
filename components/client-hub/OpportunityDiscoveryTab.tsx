
import React from 'react';

const OpportunityDiscoveryTab: React.FC = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Opportunity Discovery</h1>
                <p className="text-slate-500 font-medium">AI-matched investment opportunities based on Cap Rate and Cash on Cash returns.</p>
            </div>

            <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-3xl rounded-full -mr-20 -mt-20"></div>
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-6">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
                        AI Live Scanner Active
                    </div>
                    <h2 className="text-3xl font-black mb-4 tracking-tight">Scanning for Off-Market Leads...</h2>
                    <p className="text-slate-400 max-w-xl font-medium leading-relaxed">
                        Our AI is currently analyzing distress signals, tax liens, and motivated seller patterns in your target areas.
                        Matches will appear here as they are discovered.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl shadow-sm rotate-3">
                        <i className="fa-solid fa-house-circle-check"></i>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">High Yield Rentals</h3>
                        <p className="text-slate-500 font-medium text-sm leading-relaxed">
                            Properties with a projected gross yield of 10% or higher based on current market rents and occupancy data.
                        </p>
                    </div>
                    <button className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all">
                        Setup Alert Criteria
                    </button>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl shadow-sm -rotate-3">
                        <i className="fa-solid fa-hammer"></i>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Renovate & Flip</h3>
                        <p className="text-slate-500 font-medium text-sm leading-relaxed">
                            Fixer-uppers with a minimum 25% ARV margin and low renovation complexity scores.
                        </p>
                    </div>
                    <button className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all">
                        Define Target Margin
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OpportunityDiscoveryTab;
