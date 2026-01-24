import React, { useState } from 'react';

const SentimentAnalyzer: React.FC = () => {
    const [input, setInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<{
        sentiment: 'positive' | 'negative' | 'question' | 'neutral';
        confidence: number;
        intent: string;
        action: string;
        draftReply: string;
    } | null>(null);

    const analyzeText = () => {
        if (!input.trim()) return;
        setIsAnalyzing(true);
        setResult(null);

        // Simulate AI Latency
        setTimeout(() => {
            const lower = input.toLowerCase();
            let res: any = {
                sentiment: 'neutral',
                confidence: 85,
                intent: 'Unknown',
                action: 'Notify Agent',
                draftReply: "Thanks for your message. How can I help?"
            };

            if (lower.includes('stop') || lower.includes('remove') || lower.includes('unsubscribe')) {
                res = {
                    sentiment: 'negative',
                    confidence: 99,
                    intent: 'Opt-Out request detected',
                    action: 'Auto-Archive & Cancel Sequence',
                    draftReply: "You have been unsubscribed. No further messages will be sent."
                };
            }
            else if (lower.includes('price') || lower.includes('rate') || lower.includes('how much')) {
                res = {
                    sentiment: 'question',
                    confidence: 92,
                    intent: 'Information Gathering (Pricing)',
                    action: 'Draft "Market Data" Response',
                    draftReply: "Great question! Current rates in Denver are hovering around 6.2%. Would you like a full breakdown?"
                };
            }
            else if (lower.includes('yes') || lower.includes('book') || lower.includes('meet') || lower.includes('interested')) {
                res = {
                    sentiment: 'positive',
                    confidence: 96,
                    intent: 'High Intent / Booking',
                    action: 'Mark "Hot" & Alert Agent Immediately',
                    draftReply: "That's exciting! I have some time this Thursday at 2pm or Friday at 10am. Which works best for a quick chat?"
                };
            }

            setResult(res);
            setIsAnalyzing(false);
        }, 1200);
    };

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-xl shadow-indigo-500/5 animate-in slide-in-from-bottom-6 duration-700">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
                <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <i className="fa-solid fa-wand-magic-sparkles text-sm"></i>
                </div>
                <div>
                    <h3 className="text-base font-black text-slate-800">AI Intent Lab</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test the Response Engine</p>
                </div>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Input Side */}
                <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-1">Incoming Lead Message</label>
                    <div className="relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Paste a message here (e.g. 'Stop texting me' or 'Id be interested in hearing more')..."
                            className="w-full h-40 p-5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all resize-none text-slate-700 font-medium text-sm leading-relaxed"
                        />
                        <button
                            onClick={analyzeText}
                            disabled={isAnalyzing || !input.trim()}
                            className="absolute bottom-4 right-4 px-4 py-2 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                        >
                            {isAnalyzing ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Analyze'}
                        </button>
                    </div>
                </div>

                {/* Output Side */}
                <div className="relative min-h-[200px] flex flex-col justify-center">
                    {isAnalyzing ? (
                        <div className="text-center space-y-4">
                            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-violet-200"></i>
                            <p className="text-xs font-bold text-violet-400 uppercase tracking-widest animate-pulse">Running Sentiment Analysis...</p>
                        </div>
                    ) : result ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Sentiment Badge */}
                            <div className="flex items-center gap-3">
                                <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${result.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        result.sentiment === 'negative' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                            result.sentiment === 'question' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                'bg-slate-50 text-slate-600 border-slate-200'
                                    }`}>
                                    {result.sentiment}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">{result.confidence}% Confidence</span>
                            </div>

                            {/* Intent & Action */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Detected Intent</div>
                                    <div className="text-xs font-bold text-slate-700">{result.intent}</div>
                                </div>
                                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                                    <div className="text-[9px] font-black uppercase tracking-wider text-indigo-400 mb-1">System Action</div>
                                    <div className="text-xs font-bold text-indigo-700">{result.action}</div>
                                </div>
                            </div>

                            {/* Draft Reply */}
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2 pl-1">AI Drafted Response</div>
                                <div className="p-4 rounded-2xl bg-white border border-slate-200 text-slate-600 text-sm italic relative">
                                    "{result.draftReply}"
                                    <div className="absolute -right-2 -bottom-2 w-8 h-8 bg-violet-600 text-white rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                                        <i className="fa-solid fa-robot text-[10px]"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-slate-300">
                            <i className="fa-solid fa-microchip text-4xl mb-3 opacity-50"></i>
                            <p className="text-xs font-bold uppercase tracking-widest">Waiting for input</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SentimentAnalyzer;
