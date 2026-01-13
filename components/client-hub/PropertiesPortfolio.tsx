import React from 'react';

const PropertiesPortfolio: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
            <div className="p-10 bg-white border-b border-slate-200/60 flex items-center justify-between shadow-sm relative z-20">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Market Portfolio</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-medium text-sm">Managing listings, interests, and active transactions</span>
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1">
                    {['Market Heat', 'My Listings', 'Transactions'].map((sub) => (
                        <button key={sub} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub === 'Market Heat' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            {sub}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* Market Heat - Top 10 Trending */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 flex items-center gap-3">
                            <i className="fa-solid fa-fire-flame-curved text-orange-500"></i>
                            Trending Properties
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                            { address: '123 Luxury Way, Beverly Hills', price: '$4,250,000', hits: 156, growth: '+22%', img: 'house1' },
                            { address: '456 Modern Ave, Malibu', price: '$2,800,000', hits: 89, growth: '+12%', img: 'house2' },
                            { address: '789 Sunset Blvd, Hollywood', price: '$1,150,000', hits: 245, growth: '+45%', img: 'house3' },
                            { address: '101 Ocean Drive, Santa Monica', price: '$3,400,000', hits: 67, growth: '-5%', img: 'house4' },
                        ].map((prop, i) => (
                            <div key={i} className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-200/60 shadow-sm hover:shadow-2xl transition-all group cursor-pointer active:scale-98">
                                <div className="h-48 bg-slate-100 flex items-center justify-center relative border-b border-slate-100">
                                    <i className="fa-solid fa-house-chimney text-4xl text-slate-200 group-hover:scale-110 transition-transform"></i>
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm">
                                        {prop.hits} Views
                                    </div>
                                </div>
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-slate-900 truncate flex-1">{prop.address}</h4>
                                        <span className="text-emerald-600 font-black ml-4">{prop.growth}</span>
                                    </div>
                                    <div className="text-xl font-black text-indigo-600">{prop.price}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Sidebar - Recent Transaction Checklist */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900">Closing Roadmap</h3>
                    </div>
                    <div className="bg-white rounded-[3rem] p-8 border border-slate-200/60 shadow-xl space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-900 flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-900/20">
                                <i className="fa-solid fa-file-invoice-dollar"></i>
                            </div>
                            <div>
                                <div className="font-bold text-slate-900">123 Maple St</div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Escrow • Stage 4/6</div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {[
                                { label: 'Initial Inspection', status: 'Completed' },
                                { label: 'Loan Approval', status: 'Completed' },
                                { label: 'Appraisal Report', status: 'Action' },
                                { label: 'Title Search', status: 'Pending' },
                                { label: 'Closing Docs', status: 'Pending' },
                            ].map((step, i) => (
                                <div key={i} className="flex items-center gap-4 group">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${step.status === 'Completed' ? 'bg-emerald-500 border-emerald-500 text-white' :
                                        step.status === 'Action' ? 'bg-white border-amber-500 text-amber-500 animate-pulse' : 'bg-white border-slate-200 text-slate-200'
                                        }`}>
                                        {step.status === 'Completed' ? <i className="fa-solid fa-check text-[10px]"></i> : <div className="w-1.5 h-1.5 rounded-full bg-current"></div>}
                                    </div>
                                    <span className={`text-xs font-bold transition-colors ${step.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{step.label}</span>
                                </div>
                            ))}
                        </div>
                        <button className="w-full py-4 bg-slate-50 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-slate-100 hover:bg-slate-900 hover:text-white transition-all">
                            Open Transaction Vault
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropertiesPortfolio;
