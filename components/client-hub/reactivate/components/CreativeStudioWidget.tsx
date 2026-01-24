import React, { useState } from 'react';

const CreativeStudioWidget: React.FC = () => {
    const [selectedType, setSelectedType] = useState<'postcard' | 'video'>('postcard');
    const [isGenerating, setIsGenerating] = useState(false);

    const postcardMock = {
        frontImg: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
        headline: "The Market Moved.",
        subhead: "Did You?",
        body: "Inventory in Stapleton is down 15%. Your home value might have just jumped.",
        cta: "Scan for your new estimate."
    };

    const videoScript = `
        "Hi [Lead Name], it's Ashit. 
        I was just reviewing market numbers this morning and noticed something interesting about [Neighborhood].
        Inventory has dropped significantly, which usually signals a price jump is coming.
        I know you were thinking about selling last fall—wanted to see if you're open to a quick chat this week?"
    `;

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-indigo-500/5 animate-in slide-in-from-bottom-8 duration-700 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/5 rounded-full blur-[60px] -mr-16 -mt-16"></div>

            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-fuchsia-600 text-white flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
                        <i className="fa-solid fa-paintbrush text-lg"></i>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Creative Studio</h3>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Multi-Channel Asset Generator</p>
                    </div>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                        onClick={() => setSelectedType('postcard')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedType === 'postcard' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-400'}`}
                    >
                        <i className="fa-solid fa-envelope-open-text mr-2"></i> Postcard
                    </button>
                    <button
                        onClick={() => setSelectedType('video')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedType === 'video' ? 'bg-white text-fuchsia-600 shadow-sm' : 'text-slate-400'}`}
                    >
                        <i className="fa-solid fa-video mr-2"></i> Video
                    </button>
                </div>
            </div>

            <div className="p-8">
                {selectedType === 'postcard' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                        {/* Postcard Preview */}
                        <div className="aspect-[1.58/1] bg-slate-100 rounded-xl overflow-hidden shadow-2xl relative group cursor-pointer border-4 border-white">
                            <img src={postcardMock.frontImg} alt="Home" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent flex flex-col justify-end p-6">
                                <h2 className="text-3xl font-black text-white italic leading-none mb-1">{postcardMock.headline}</h2>
                                <p className="text-fuchsia-400 font-bold uppercase tracking-widest text-xs">{postcardMock.subhead}</p>
                                <div className="mt-4 pt-4 border-t border-white/20">
                                    <p className="text-white/80 text-xs font-medium leading-relaxed max-w-[80%]">
                                        {postcardMock.body}
                                    </p>
                                    <button className="mt-3 px-3 py-1 bg-white text-slate-900 text-[9px] font-black uppercase tracking-wider rounded">
                                        {postcardMock.cta}
                                    </button>
                                </div>
                            </div>
                            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-wider border border-white/20">
                                4x6 Front
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="space-y-6 flex flex-col justify-center">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 mb-2">AI Design Logic</h4>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                    We analyzed this lead's browsing history (viewed homes &gt;$800k in Stapleton). This design highlights <span className="text-fuchsia-600 font-bold">Recent Market Shifts</span> to trigger FOMO.
                                </p>
                            </div>
                            <div className="space-y-3">
                                <button className="w-full py-4 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-600 font-bold text-xs uppercase tracking-wider hover:border-fuchsia-200 hover:text-fuchsia-600 transition-all flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-arrows-rotate"></i> Regenerate Variant
                                </button>
                                <button className="w-full py-4 rounded-xl bg-fuchsia-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-fuchsia-700 shadow-xl shadow-fuchsia-600/20 transition-all flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-print"></i> Send via Lob ($0.72)
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                        {/* Teleprompter Visual */}
                        <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Teleprompter Active</span>
                                </div>
                                <span className="text-[9px] font-mono text-slate-500">00:00 / 00:45</span>
                            </div>
                            <div className="flex-1 flex items-center justify-center text-center">
                                <p className="text-xl md:text-2xl font-medium text-white/90 leading-relaxed font-serif italic">
                                    "{videoScript}"
                                </p>
                            </div>
                            <div className="mt-4 flex justify-center gap-4">
                                <button className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">
                                    <i className="fa-solid fa-circle text-2xl"></i>
                                </button>
                            </div>
                        </div>

                        {/* Side Panel */}
                        <div className="space-y-6 flex flex-col justify-center">
                            <div>
                                <h4 className="text-sm font-black text-slate-800 mb-2">Personalized Script</h4>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                    This script mentions their specific neighborhood <b>[Stapleton]</b> and addresses the specific stall reason <b>[Waiting for Price Drop]</b>.
                                </p>
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                <div className="flex items-start gap-3">
                                    <i className="fa-solid fa-lightbulb text-indigo-500 mt-1"></i>
                                    <div className="text-xs text-indigo-800 font-medium">
                                        <b>Pro Tip:</b> Keep it under 45 seconds. Mentioning their name in the first 3 seconds increases watch rate by 210%.
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <button className="w-full py-4 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-600 font-bold text-xs uppercase tracking-wider hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-pen"></i> Edit Script
                                </button>
                                <button className="w-full py-4 rounded-xl bg-fuchsia-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-fuchsia-700 shadow-xl shadow-fuchsia-600/20 transition-all flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-share-nodes"></i> Send Video Message
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CreativeStudioWidget;
