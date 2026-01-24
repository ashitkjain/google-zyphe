import React, { useState } from 'react';
import { Lead } from '../../../../types';

interface BulkCampaignBuilderProps {
    leads: Lead[];
    onClose: () => void;
    onLaunch: (payload: { title: string; strategy: string; message: string; channel: string }) => void;
}

const STRATEGIES = [
    {
        id: 'market_update',
        icon: 'fa-chart-line',
        name: 'Market Shift Update',
        desc: 'Share recent stats (e.g. Rate Drop) to re-spark interest.',
        template: "Hi {firstName}, wanted to share a quick update: Rates just dipped to 6.2% in {city}, sparking a mini-frenzy. Are you still thinking about that move?"
    },
    {
        id: 'inventory_alert',
        icon: 'fa-home',
        name: 'Low Inventory Alert',
        desc: 'Highlight scarcity to create urgency.',
        template: "Hey {firstName}, inventory is tight right now! Only 3 homes popped up in {city} this week under {budget}. Should I send them over?"
    },
    {
        id: 'casual_check_in',
        icon: 'fa-coffee',
        name: 'Casual Re-connect',
        desc: 'Low pressure check-in to gauge timing.',
        template: "Hi {firstName}, it's been a while! Just clearing out my files and wondered if you bought a home yet or if you're still looking?"
    }
];

const BulkCampaignBuilder: React.FC<BulkCampaignBuilderProps> = ({ leads, onClose, onLaunch }) => {
    const [selectedStrategyId, setSelectedStrategyId] = useState('market_update');
    const [customMessage, setCustomMessage] = useState('');
    const [channel, setChannel] = useState('sms');

    const activeStrategy = STRATEGIES.find(s => s.id === selectedStrategyId)!;

    // Auto-fill template if custom message is empty or matches another template
    React.useEffect(() => {
        setCustomMessage(activeStrategy.template);
    }, [selectedStrategyId]);

    const handleLaunch = () => {
        onLaunch({
            title: activeStrategy.name,
            strategy: activeStrategy.id,
            message: customMessage,
            channel
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <i className="fa-solid fa-layer-group text-lg"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">Bulk Reactivation Campaign</h2>
                            <p className="text-sm font-medium text-slate-500">Targeting <span className="text-indigo-600 font-bold">{leads.length} Leads</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-12 gap-8">
                    {/* Left: Strategy Selection */}
                    <div className="col-span-5 space-y-6">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Select Strategy</label>
                        <div className="space-y-3">
                            {STRATEGIES.map(strat => (
                                <button
                                    key={strat.id}
                                    onClick={() => setSelectedStrategyId(strat.id)}
                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all group relative overflow-hidden ${selectedStrategyId === strat.id
                                            ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600/20'
                                            : 'border-slate-100 hover:border-indigo-200 hover:bg-white'
                                        }`}
                                >
                                    <div className="flex items-start gap-4 reltaive z-10">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${selectedStrategyId === strat.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                                            }`}>
                                            <i className={`fa-solid ${strat.icon}`}></i>
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-sm mb-1 ${selectedStrategyId === strat.id ? 'text-indigo-900' : 'text-slate-700'}`}>{strat.name}</h4>
                                            <p className="text-xs text-slate-500 leading-relaxed font-medium">{strat.desc}</p>
                                        </div>
                                    </div>
                                    {selectedStrategyId === strat.id && (
                                        <div className="absolute right-4 top-4 text-indigo-600">
                                            <i className="fa-solid fa-circle-check"></i>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Customization */}
                    <div className="col-span-7 space-y-8">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1 mb-3 block">Delivery Channel</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                {['sms', 'email'].map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setChannel(c)}
                                        className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${channel === c ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-3 px-1">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Message Preview</label>
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">
                                    {customMessage.length} chars
                                </span>
                            </div>
                            <div className="relative group">
                                <textarea
                                    value={customMessage}
                                    onChange={(e) => setCustomMessage(e.target.value)}
                                    className="w-full h-40 p-5 rounded-2xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none text-slate-700 font-medium text-sm leading-relaxed"
                                ></textarea>
                                <div className="absolute bottom-4 right-4 flex gap-2">
                                    <div className="px-2 py-1 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                        Substitutions active: {"{firstName}"}, {"{city}"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <i className="fa-solid fa-clock"></i>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-emerald-900 mb-1">Drip Scheduler</h4>
                                <p className="text-xs font-medium text-emerald-700/80 leading-relaxed">
                                    The campaign will start immediately. If no reply is received within 3 days, our AI will automatically follow up.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-400">
                        Estimated Reach: {Math.round(leads.length * 0.85)} leads (approx 85% valid contacts)
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleLaunch}
                            className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-2"
                        >
                            <i className="fa-solid fa-paper-plane"></i> Launch Campaign
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkCampaignBuilder;
